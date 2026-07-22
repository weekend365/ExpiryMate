import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AccountType,
  OAuthProvider,
  OneTimeAuthTokenPurpose,
  UserRole,
  type User,
} from "@prisma/client";
import type {
  AuthSession,
  AuthUser,
  RegisterPendingResponse,
} from "@expirymate/shared";
import argon2 from "argon2";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature,
  createPublicKey,
  type JsonWebKey,
} from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import {
  ForgotPasswordDto,
  LoginDto,
  OAuthLoginDto,
  RegisterDto,
  ResetPasswordDto,
  StartOAuthDto,
} from "./dto/auth.dto";
import { MailService } from "./mail.service";
import type { AuthenticatedUser, OAuthProfile } from "./auth.types";
import {
  getOAuthAppReturnAllowlist,
  getOAuthProviderRedirectUri,
  isAllowedOAuthReturnUri,
} from "../health/oauth-callback";

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  accountType: AccountType;
  iat: number;
  exp: number;
  typ: "access";
}

const DEFAULT_OWNER_KEY = "demo-user";
const DEV_SECRET = "expirymate-local-auth-secret";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_DAYS = 30;
const PASSWORD_RESET_MINUTES = 15;
const EMAIL_VERIFICATION_HOURS = 24;
const OAUTH_AUTHORIZATION_MINUTES = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Test/legacy helper only — HTTP minting was removed (PROJECT: 익명 세션 ❌).
   * Keeps merge/JWT coverage for residual anonymous rows until they age out.
   */
  async issueAnonymousSession(): Promise<AuthSession> {
    const user = await this.prisma.user.create({
      data: {
        id: `anon_${randomUUID()}`,
        accountType: AccountType.anonymous,
        role: UserRole.user,
      },
    });

    return this.createSession(user);
  }

  async register(
    dto: RegisterDto,
    actor?: AuthenticatedUser,
  ): Promise<RegisterPendingResponse> {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });

    if (existingUser && existingUser.emailVerifiedAt) {
      throw new ConflictException("이미 가입된 이메일이에요. 로그인으로 들어와 주세요.");
    }

    // Unverified re-register: only resend verification. Never overwrite password/displayName
    // (attackers must not replace credentials before the victim verifies).
    if (existingUser && !existingUser.emailVerifiedAt) {
      await this.mergeAnonymousUser(actor?.userId, existingUser.id);
      await this.sendEmailVerificationOrThrow(existingUser.id, email);

      return { requiresEmailVerification: true, email };
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName,
        accountType: AccountType.registered,
        role: UserRole.user,
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
      },
    });

    await this.mergeAnonymousUser(actor?.userId, user.id);
    await this.sendEmailVerificationOrThrow(user.id, email);

    return { requiresEmailVerification: true, email };
  }

  async login(dto: LoginDto, actor?: AuthenticatedUser): Promise<AuthSession> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });

    if (
      !user?.passwordCredential ||
      user.deletedAt ||
      user.mergedIntoUserId
    ) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const isValidPassword = await argon2.verify(
      user.passwordCredential.passwordHash,
      dto.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        "메일 확인이 아직이에요. 받은편지함을 살펴봐 주세요.",
      );
    }

    await this.mergeAnonymousUser(actor?.userId, user.id);

    return this.createSession(user, true);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const tokenHash = hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.user.mergedIntoUserId || session.user.deletedAt) {
      throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    }

    // Reuse of an already-rotated refresh token → revoke the whole family.
    if (session.revokedAt && session.replacedByTokenHash) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        "로그인 세션이 만료됐어요. 다시 이어가 주세요.",
      );
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    }

    const nextRefreshToken = createOpaqueToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const expiresAt = addDays(new Date(), getRefreshTokenDays());

    await this.prisma.$transaction(async (tx) => {
      const rotated = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: nextRefreshTokenHash,
        },
      });

      if (rotated.count !== 1) {
        throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
      }

      await tx.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: nextRefreshTokenHash,
          expiresAt,
        },
      });
    });

    const hasPassword = await this.prisma.passwordCredential.findUnique({
      where: { userId: session.userId },
      select: { userId: true },
    });

    return {
      user: serializeUser(session.user, Boolean(hasPassword)),
      accessToken: this.signAccessToken(session.user),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passwordCredential: true },
    });

    if (!user || user.mergedIntoUserId || user.deletedAt) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    return serializeUser(user, Boolean(user.passwordCredential));
  }

  async requestEmailVerification(userId?: string, email?: string) {
    const user = await this.findUserForOneTimeToken(userId, email);

    if (user.email && !user.emailVerifiedAt) {
      await this.createAndSendOneTimeToken(
        user.id,
        user.email,
        OneTimeAuthTokenPurpose.email_verification,
      );
    }

    return { ok: true };
  }

  async verifyEmail(token: string): Promise<AuthSession> {
    const user = await this.markEmailVerifiedFromToken(token);
    return this.createSession(user, true);
  }

  /** Desktop bridge: mark verified without issuing an app session. */
  async confirmEmailVerification(token: string): Promise<{ ok: true }> {
    await this.markEmailVerifiedFromToken(token);
    return { ok: true };
  }

  async getEmailVerificationStatus(email: string): Promise<{ verified: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { emailVerifiedAt: true, deletedAt: true, mergedIntoUserId: true },
    });

    if (!user || user.deletedAt || user.mergedIntoUserId) {
      return { verified: false };
    }

    return { verified: Boolean(user.emailVerifiedAt) };
  }

  private async markEmailVerifiedFromToken(token: string) {
    const record = await this.consumeOneTimeToken(
      token,
      OneTimeAuthTokenPurpose.email_verification,
    );

    return this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });

    if (user?.email) {
      await this.createAndSendOneTimeToken(
        user.id,
        user.email,
        OneTimeAuthTokenPurpose.password_reset,
      );
    }

    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.consumeOneTimeToken(
      dto.token,
      OneTimeAuthTokenPurpose.password_reset,
    );
    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.passwordCredential.upsert({
      where: { userId: record.userId },
      create: {
        userId: record.userId,
        passwordHash,
      },
      update: {
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    });
    await this.prisma.refreshSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }

  async oauthLogin(
    provider: OAuthProvider,
    dto: OAuthLoginDto,
    actor?: AuthenticatedUser,
  ): Promise<AuthSession> {
    const profile = await this.verifyOAuthProfile(provider, dto);
    const user = await this.findOrCreateOAuthUser(profile);

    await this.mergeAnonymousUser(actor?.userId, user.id);

    return this.createSession(user, false);
  }

  async startOAuthAuthorization(dto: StartOAuthDto) {
    const provider = dto.provider as OAuthProvider;
    const returnUri = dto.returnUri.trim();
    const allowlist = getOAuthAppReturnAllowlist();

    if (!isAllowedOAuthReturnUri(returnUri, allowlist)) {
      throw new BadRequestException(
        "이 앱 주소로는 소셜 로그인을 이어갈 수 없어요.",
      );
    }

    const redirectUri = getOAuthProviderRedirectUri();
    if (!redirectUri) {
      throw new ServiceUnavailableException(
        "소셜 로그인 연결 주소 설정을 확인할 수 없어요.",
      );
    }

    const state = createOpaqueToken();
    const codeVerifier = createPkceVerifier();
    const codeChallenge = createPkceChallengeS256(codeVerifier);
    const expiresAt = addMinutes(new Date(), OAUTH_AUTHORIZATION_MINUTES);

    await this.prisma.oAuthAuthorizationSession.create({
      data: {
        state,
        provider,
        returnUri,
        redirectUri,
        codeVerifier,
        expiresAt,
      },
    });

    return {
      state,
      codeChallenge,
      codeChallengeMethod: "S256" as const,
      redirectUri,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async markOAuthAuthorizationRedirected(rawState?: string | null) {
    const state = rawState?.trim();
    if (!state) {
      return null;
    }

    const session = await this.prisma.oAuthAuthorizationSession.findUnique({
      where: { state },
    });

    if (!session || session.consumedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (!isAllowedOAuthReturnUri(session.returnUri)) {
      return null;
    }

    if (!session.redirectedAt) {
      await this.prisma.oAuthAuthorizationSession.update({
        where: { id: session.id },
        data: { redirectedAt: new Date() },
      });
    }

    return {
      state: session.state,
      returnUri: session.returnUri,
      provider: session.provider,
    };
  }

  private async consumeOAuthAuthorizationSession(
    provider: OAuthProvider,
    rawState?: string,
  ) {
    const state = rawState?.trim();
    if (!state) {
      throw new UnauthorizedException(
        "소셜 로그인 연결 정보가 없어요. 다시 시작해 주세요.",
      );
    }

    const session = await this.prisma.oAuthAuthorizationSession.findUnique({
      where: { state },
    });

    if (
      !session ||
      session.provider !== provider ||
      session.consumedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(
        "소셜 로그인 연결이 만료됐어요. 다시 시작해 주세요.",
      );
    }

    await this.prisma.oAuthAuthorizationSession.update({
      where: { id: session.id },
      data: { consumedAt: new Date() },
    });

    return session;
  }

  verifyAccessToken(token: string): AuthenticatedUser {
    const payload = verifyJwt<AccessTokenPayload>(token, this.getSecret());

    if (payload.typ !== "access" || payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    }

    return {
      userId: payload.sub,
      ownerKey: payload.sub,
      role: payload.role,
      accountType: payload.accountType,
      tokenKind: "access",
    };
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedUser> {
    const payloadUser = this.verifyAccessToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payloadUser.userId },
    });

    if (!user || user.mergedIntoUserId || user.deletedAt) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    return {
      userId: user.id,
      ownerKey: user.id,
      role: user.role,
      accountType: user.accountType,
      tokenKind: "access",
    };
  }

  getDevFallbackUser(): AuthenticatedUser | null {
    if (process.env.AUTH_ALLOW_DEV_FALLBACK !== "true") {
      return null;
    }

    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return {
      userId: process.env.DEFAULT_OWNER_KEY ?? DEFAULT_OWNER_KEY,
      ownerKey: process.env.DEFAULT_OWNER_KEY ?? DEFAULT_OWNER_KEY,
      role: UserRole.admin,
      accountType: AccountType.registered,
      tokenKind: "dev",
    };
  }

  async getOptionalUserFromBearer(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;

    if (!token) {
      return undefined;
    }

    try {
      return await this.authenticateAccessToken(token);
    } catch {
      return undefined;
    }
  }

  private async createSession(
    user: User,
    hasPasswordCredential = false,
  ): Promise<AuthSession> {
    if (user.deletedAt || user.mergedIntoUserId) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    const refreshToken = createOpaqueToken();
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: addDays(new Date(), getRefreshTokenDays()),
      },
    });

    return {
      user: serializeUser(user, hasPasswordCredential),
      accessToken: this.signAccessToken(user),
      refreshToken,
    };
  }

  private signAccessToken(user: User) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Number(
      process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? ACCESS_TOKEN_TTL_SECONDS,
    );

    return signJwt<AccessTokenPayload>(
      {
        sub: user.id,
        role: user.role,
        accountType: user.accountType,
        iat: now,
        exp: now + ttl,
        typ: "access",
      },
      this.getSecret(),
    );
  }

  private async findUserForOneTimeToken(userId?: string, email?: string) {
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : email
        ? await this.prisma.user.findUnique({
            where: { email: normalizeEmail(email) },
          })
        : null;

    if (!user?.email) {
      throw new BadRequestException("인증 메일을 보낼 계정을 찾을 수 없습니다.");
    }

    return user;
  }

  private async sendEmailVerificationOrThrow(userId: string, email: string) {
    try {
      await this.createAndSendOneTimeToken(
        userId,
        email,
        OneTimeAuthTokenPurpose.email_verification,
      );
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        "확인 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      );
    }
  }

  private async createAndSendOneTimeToken(
    userId: string,
    email: string,
    purpose: OneTimeAuthTokenPurpose,
  ) {
    const token = createOpaqueToken();
    const expiresAt =
      purpose === OneTimeAuthTokenPurpose.password_reset
        ? addMinutes(new Date(), PASSWORD_RESET_MINUTES)
        : addHours(new Date(), EMAIL_VERIFICATION_HOURS);

    await this.prisma.oneTimeAuthToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        purpose,
        expiresAt,
      },
    });

    if (purpose === OneTimeAuthTokenPurpose.password_reset) {
      await this.mailService.sendPasswordReset(email, token);
      return;
    }

    await this.mailService.sendEmailVerification(email, token);
  }

  private async consumeOneTimeToken(
    token: string,
    purpose: OneTimeAuthTokenPurpose,
  ) {
    const record = await this.prisma.oneTimeAuthToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !record ||
      record.purpose !== purpose ||
      record.consumedAt ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException("토큰이 만료되었거나 올바르지 않습니다.");
    }

    return this.prisma.oneTimeAuthToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  private async mergeAnonymousUser(anonymousUserId?: string, targetUserId?: string) {
    if (!anonymousUserId || !targetUserId || anonymousUserId === targetUserId) {
      return;
    }

    const anonymousUser = await this.prisma.user.findUnique({
      where: { id: anonymousUserId },
    });

    if (
      !anonymousUser ||
      anonymousUser.accountType !== AccountType.anonymous ||
      anonymousUser.mergedIntoUserId ||
      anonymousUser.deletedAt
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          aiDataNoticeAcceptedAt: true,
          aiDataNoticeVersion: true,
        },
      });

      await tx.inventoryItem.updateMany({
        where: { ownerKey: anonymousUserId },
        data: { ownerKey: targetUserId },
      });
      await tx.recipeRecommendation.updateMany({
        where: { ownerKey: anonymousUserId },
        data: { ownerKey: targetUserId },
      });
      await tx.subscriptionEntitlement.updateMany({
        where: { ownerKey: anonymousUserId },
        data: { ownerKey: targetUserId },
      });
      await tx.pushToken.updateMany({
        where: { ownerKey: anonymousUserId },
        data: { ownerKey: targetUserId },
      });
      await tx.pushNotificationDelivery.updateMany({
        where: { ownerKey: anonymousUserId },
        data: { ownerKey: targetUserId },
      });

      const targetPreference = await tx.notificationPreference.findUnique({
        where: { ownerKey: targetUserId },
      });
      const anonymousPreference = await tx.notificationPreference.findUnique({
        where: { ownerKey: anonymousUserId },
      });

      if (anonymousPreference && !targetPreference) {
        await tx.notificationPreference.update({
          where: { ownerKey: anonymousUserId },
          data: { ownerKey: targetUserId },
        });
      }

      await tx.refreshSession.updateMany({
        where: { userId: anonymousUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (
        anonymousUser.aiDataNoticeAcceptedAt &&
        !targetUser?.aiDataNoticeAcceptedAt
      ) {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            aiDataNoticeAcceptedAt: anonymousUser.aiDataNoticeAcceptedAt,
            aiDataNoticeVersion: anonymousUser.aiDataNoticeVersion,
          },
        });
      }
      await tx.user.update({
        where: { id: anonymousUserId },
        data: { mergedIntoUserId: targetUserId },
      });
    });
  }

  private async findOrCreateOAuthUser(profile: OAuthProfile) {
    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return existingAccount.user;
    }

    const email = profile.email ? normalizeEmail(profile.email) : undefined;
    // Never auto-link by email alone — that lets a forged/untrusted email claim
    // take over an existing password account. Account linking needs step-up auth.
    if (email) {
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(
          "이미 다른 방법으로 가입된 이메일이에요. 그 계정으로 로그인해 주세요.",
        );
      }
    }

    return this.prisma.user.create({
      data: {
        email,
        displayName: profile.displayName,
        accountType: AccountType.registered,
        role: UserRole.user,
        emailVerifiedAt: profile.emailVerified ? new Date() : undefined,
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            email,
          },
        },
      },
    });
  }

  private async verifyOAuthProfile(
    provider: OAuthProvider,
    dto: OAuthLoginDto,
  ): Promise<OAuthProfile> {
    if (provider === OAuthProvider.apple) {
      return verifyAppleToken(dto.providerToken, dto.displayName);
    }

    const authorization = await this.consumeOAuthAuthorizationSession(
      provider,
      dto.state,
    );

    if (provider === OAuthProvider.google) {
      return verifyGoogleCode(
        dto.providerToken,
        authorization.redirectUri,
        authorization.codeVerifier,
      );
    }

    if (provider === OAuthProvider.kakao) {
      return verifyKakaoCode(
        dto.providerToken,
        authorization.redirectUri,
        authorization.codeVerifier,
      );
    }

    if (provider === OAuthProvider.naver) {
      return verifyNaverCode(dto.providerToken, authorization.state);
    }

    throw new UnauthorizedException("지원하지 않는 소셜 로그인이에요.");
  }

  private getSecret() {
    const secret = process.env.AUTH_TOKEN_SECRET;

    if (secret) {
      return secret;
    }

    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException(
        "AUTH_TOKEN_SECRET 환경변수가 설정되지 않았습니다.",
      );
    }

    return DEV_SECRET;
  }
}

export function serializeUser(
  user: User,
  hasPasswordCredential = false,
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accountType: user.accountType,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    requiresEmailVerification:
      hasPasswordCredential && !user.emailVerifiedAt,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

/** RFC 7636 code_verifier: 43–128 chars from unreserved set. */
function createPkceVerifier() {
  return randomBytes(32).toString("base64url");
}

function createPkceChallengeS256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getRefreshTokenDays() {
  return Number(process.env.AUTH_REFRESH_TOKEN_DAYS ?? REFRESH_TOKEN_DAYS);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function signJwt<T extends object>(payload: T, secret: string) {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const input = `${header}.${body}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");

  return `${input}.${signature}`;
}

function verifyJwt<T>(token: string, secret: string): T {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) {
    throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
  }
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(new Uint8Array(leftBuffer), new Uint8Array(rightBuffer));
}

async function verifyGoogleCode(
  authorizationCode: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthProfile> {
  const clientId = getRequiredOAuthClientId("GOOGLE_OAUTH_CLIENT_ID", "Google");
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();

  if (!clientSecret) {
    throw new ServiceUnavailableException(
      "Google OAuth 설정을 확인할 수 없습니다.",
    );
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      redirect_uri: redirectUri.trim(),
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    throw new UnauthorizedException("Google 로그인 코드를 확인하지 못했습니다.");
  }

  const tokenPayload = (await tokenResponse.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenPayload.id_token) {
    throw new UnauthorizedException(
      tokenPayload.error_description ??
        "Google 로그인 토큰을 받지 못했어요.",
    );
  }

  return verifyGoogleIdToken(tokenPayload.id_token, clientId);
}

async function verifyGoogleIdToken(
  providerToken: string,
  expectedClientId: string,
): Promise<OAuthProfile> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(providerToken)}`,
  );

  if (!response.ok) {
    throw new UnauthorizedException("Google 로그인 토큰을 확인하지 못했습니다.");
  }

  const payload = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    aud?: string;
  };

  if (payload.aud !== expectedClientId) {
    throw new UnauthorizedException("Google 로그인 토큰 대상이 올바르지 않습니다.");
  }

  if (!payload.sub) {
    throw new UnauthorizedException("Google 사용자 정보를 확인하지 못했습니다.");
  }

  return {
    provider: OAuthProvider.google,
    providerUserId: payload.sub,
    email: payload.email,
    displayName: payload.name,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}

async function verifyKakaoCode(
  authorizationCode: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthProfile> {
  const clientId = getRequiredOAuthClientId("KAKAO_OAUTH_CLIENT_ID", "Kakao");
  const clientSecret = process.env.KAKAO_OAUTH_CLIENT_SECRET?.trim();

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri.trim(),
    code: authorizationCode,
    code_verifier: codeVerifier,
  });

  if (clientSecret) {
    tokenBody.set("client_secret", clientSecret);
  }

  const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    throw new UnauthorizedException("Kakao 로그인 코드를 확인하지 못했습니다.");
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenPayload.access_token) {
    throw new UnauthorizedException(
      tokenPayload.error_description ??
        "Kakao 로그인 토큰을 받지 못했어요.",
    );
  }

  return verifyKakaoAccessToken(tokenPayload.access_token);
}

async function verifyKakaoAccessToken(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new UnauthorizedException("Kakao 로그인 토큰을 확인하지 못했습니다.");
  }

  const payload = (await response.json()) as {
    id?: number;
    kakao_account?: {
      email?: string;
      profile?: { nickname?: string };
    };
  };

  if (!payload.id) {
    throw new UnauthorizedException("Kakao 사용자 정보를 확인하지 못했습니다.");
  }

  return {
    provider: OAuthProvider.kakao,
    providerUserId: String(payload.id),
    email: payload.kakao_account?.email,
    displayName: payload.kakao_account?.profile?.nickname,
    emailVerified: Boolean(payload.kakao_account?.email),
  };
}

async function verifyNaverCode(
  authorizationCode: string,
  oauthState?: string,
): Promise<OAuthProfile> {
  const clientId = getRequiredOAuthClientId("NAVER_OAUTH_CLIENT_ID", "Naver");
  const clientSecret = process.env.NAVER_OAUTH_CLIENT_SECRET?.trim();

  if (!clientSecret) {
    throw new ServiceUnavailableException(
      "Naver OAuth 설정을 확인할 수 없습니다.",
    );
  }

  const tokenResponse = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      state: oauthState?.trim() || "expirymate",
    }).toString(),
  });

  if (!tokenResponse.ok) {
    throw new UnauthorizedException("Naver 로그인 코드를 확인하지 못했습니다.");
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenPayload.access_token) {
    throw new UnauthorizedException(
      tokenPayload.error_description ??
        "Naver 로그인 토큰을 받지 못했어요.",
    );
  }

  const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });

  if (!profileResponse.ok) {
    throw new UnauthorizedException("Naver 사용자 정보를 확인하지 못했습니다.");
  }

  const profilePayload = (await profileResponse.json()) as {
    resultcode?: string;
    response?: {
      id?: string;
      email?: string;
      name?: string;
      nickname?: string;
    };
  };

  if (profilePayload.resultcode !== "00" || !profilePayload.response?.id) {
    throw new UnauthorizedException("Naver 사용자 정보를 확인하지 못했습니다.");
  }

  const profile = profilePayload.response;
  const providerUserId = profile.id;

  if (!providerUserId) {
    throw new UnauthorizedException("Naver 사용자 정보를 확인하지 못했습니다.");
  }

  return {
    provider: OAuthProvider.naver,
    providerUserId,
    email: profile.email,
    displayName: profile.nickname ?? profile.name,
    emailVerified: Boolean(profile.email),
  };
}

async function verifyAppleToken(
  providerToken: string,
  displayName?: string,
): Promise<OAuthProfile> {
  const expectedClientId = getRequiredOAuthClientId(
    "APPLE_OAUTH_CLIENT_ID",
    "Apple",
  );
  const [, payloadPart] = providerToken.split(".");

  if (!payloadPart) {
    throw new UnauthorizedException("Apple 로그인 토큰이 올바르지 않습니다.");
  }

  await verifyAppleSignature(providerToken);

  const payload = parseBase64UrlJson<{
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    aud?: string;
    exp?: number;
  }>(payloadPart, "Apple 로그인 토큰이 올바르지 않습니다.");

  if (payload.aud !== expectedClientId) {
    throw new UnauthorizedException("Apple 로그인 토큰 대상이 올바르지 않습니다.");
  }

  if (!payload.sub || !payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new UnauthorizedException("Apple 로그인 토큰이 만료되었거나 올바르지 않습니다.");
  }

  // Only trust the signed id_token email claim — never client body email.
  const email = payload.email;
  const emailVerified =
    Boolean(email) &&
    (payload.email_verified === undefined ||
      payload.email_verified === true ||
      payload.email_verified === "true");

  return {
    provider: OAuthProvider.apple,
    providerUserId: payload.sub,
    email,
    displayName,
    emailVerified,
  };
}

async function verifyAppleSignature(token: string) {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart) {
    throw new UnauthorizedException("Apple 로그인 토큰이 올바르지 않습니다.");
  }
  const header = parseBase64UrlJson<{
    kid?: string;
    alg?: string;
  }>(headerPart, "Apple 로그인 토큰이 올바르지 않습니다.");

  if (header.alg !== "RS256" || !header.kid || !payloadPart || !signaturePart) {
    throw new UnauthorizedException("Apple 로그인 토큰이 올바르지 않습니다.");
  }

  const response = await fetch("https://appleid.apple.com/auth/keys");

  if (!response.ok) {
    throw new UnauthorizedException("Apple 공개키를 확인하지 못했습니다.");
  }

  const body = (await response.json()) as { keys?: Array<Record<string, unknown>> };
  const key = body.keys?.find((candidate) => candidate.kid === header.kid);

  if (!key) {
    throw new UnauthorizedException("Apple 로그인 토큰 키를 확인하지 못했습니다.");
  }

  const isValid = verifySignature(
    "RSA-SHA256",
    new Uint8Array(Buffer.from(`${headerPart}.${payloadPart}`)),
    createPublicKey({ key: key as JsonWebKey, format: "jwk" }),
    new Uint8Array(Buffer.from(signaturePart, "base64url")),
  );

  if (!isValid) {
    throw new UnauthorizedException("Apple 로그인 토큰 서명이 올바르지 않습니다.");
  }
}

function getRequiredOAuthClientId(
  key:
    | "APPLE_OAUTH_CLIENT_ID"
    | "GOOGLE_OAUTH_CLIENT_ID"
    | "KAKAO_OAUTH_CLIENT_ID"
    | "NAVER_OAUTH_CLIENT_ID",
  providerLabel: string,
) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new ServiceUnavailableException(
      `${providerLabel} OAuth 설정을 확인할 수 없습니다.`,
    );
  }

  return value;
}

function parseBase64UrlJson<T>(value: string, errorMessage: string): T {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    throw new UnauthorizedException(errorMessage);
  }
}
