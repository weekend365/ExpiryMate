import {
  BadRequestException,
  ConflictException,
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
import type { AuthSession, AuthUser } from "@expirymate/shared";
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
} from "./dto/auth.dto";
import { MailService } from "./mail.service";
import type { AuthenticatedUser, OAuthProfile } from "./auth.types";

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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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

  async register(dto: RegisterDto, actor?: AuthenticatedUser): Promise<AuthSession> {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException("이미 가입된 이메일입니다.");
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
    await this.createAndSendOneTimeToken(
      user.id,
      email,
      OneTimeAuthTokenPurpose.email_verification,
    );

    return this.createSession(user);
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

    await this.mergeAnonymousUser(actor?.userId, user.id);

    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const tokenHash = hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.mergedIntoUserId ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    }

    const nextRefreshToken = createOpaqueToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const expiresAt = addDays(new Date(), getRefreshTokenDays());

    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: nextRefreshTokenHash,
        },
      }),
      this.prisma.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: nextRefreshTokenHash,
          expiresAt,
        },
      }),
    ]);

    return {
      user: serializeUser(session.user),
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.mergedIntoUserId || user.deletedAt) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    return serializeUser(user);
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

  async verifyEmail(token: string) {
    const record = await this.consumeOneTimeToken(
      token,
      OneTimeAuthTokenPurpose.email_verification,
    );

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });

    return { ok: true };
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

    return this.createSession(user);
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
    if (process.env.AUTH_ALLOW_DEV_FALLBACK === "false") {
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

  private async createSession(user: User): Promise<AuthSession> {
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
      user: serializeUser(user),
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
    const existingUser = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;

    if (existingUser) {
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerifiedAt:
            existingUser.emailVerifiedAt ??
            (profile.emailVerified ? new Date() : undefined),
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
    if (provider === OAuthProvider.google) {
      return verifyGoogleToken(dto.providerToken);
    }

    if (provider === OAuthProvider.kakao) {
      return verifyKakaoToken(dto.providerToken);
    }

    return verifyAppleToken(dto.providerToken, dto);
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

export function serializeUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accountType: user.accountType,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
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

async function verifyGoogleToken(providerToken: string): Promise<OAuthProfile> {
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
  const expectedClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

  if (expectedClientId && payload.aud !== expectedClientId) {
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

async function verifyKakaoToken(providerToken: string): Promise<OAuthProfile> {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${providerToken}` },
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

async function verifyAppleToken(
  providerToken: string,
  dto: OAuthLoginDto,
): Promise<OAuthProfile> {
  const [, payloadPart] = providerToken.split(".");

  if (!payloadPart) {
    throw new UnauthorizedException("Apple 로그인 토큰이 올바르지 않습니다.");
  }

  await verifyAppleSignature(providerToken);

  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
    sub?: string;
    email?: string;
    aud?: string;
    exp?: number;
  };
  const expectedClientId = process.env.APPLE_OAUTH_CLIENT_ID;

  if (expectedClientId && payload.aud !== expectedClientId) {
    throw new UnauthorizedException("Apple 로그인 토큰 대상이 올바르지 않습니다.");
  }

  if (!payload.sub || !payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new UnauthorizedException("Apple 로그인 토큰이 만료되었거나 올바르지 않습니다.");
  }

  return {
    provider: OAuthProvider.apple,
    providerUserId: payload.sub,
    email: payload.email ?? dto.email,
    displayName: dto.displayName,
    emailVerified: Boolean(payload.email ?? dto.email),
  };
}

async function verifyAppleSignature(token: string) {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart) {
    throw new UnauthorizedException("Apple 로그인 토큰이 올바르지 않습니다.");
  }
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as {
    kid?: string;
    alg?: string;
  };

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
