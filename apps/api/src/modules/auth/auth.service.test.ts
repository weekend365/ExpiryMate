import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AccountType,
  OAuthProvider,
  OneTimeAuthTokenPurpose,
  UserRole,
} from "@prisma/client";
import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const originalSecret = process.env.AUTH_TOKEN_SECRET;
  const originalDevFallback = process.env.AUTH_ALLOW_DEV_FALLBACK;
  const originalAppleClientId = process.env.APPLE_OAUTH_CLIENT_ID;
  const originalGoogleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const originalNaverClientId = process.env.NAVER_OAUTH_CLIENT_ID;
  const originalNaverClientSecret = process.env.NAVER_OAUTH_CLIENT_SECRET;
  const originalOAuthProviderRedirect = process.env.OAUTH_PROVIDER_REDIRECT_URI;
  const originalOAuthAppReturnUris = process.env.OAUTH_APP_RETURN_URIS;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.AUTH_TOKEN_SECRET = "test-auth-token-secret";
    delete process.env.AUTH_ALLOW_DEV_FALLBACK;
    delete process.env.APPLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.NAVER_OAUTH_CLIENT_ID;
    delete process.env.NAVER_OAUTH_CLIENT_SECRET;
    delete process.env.OAUTH_PROVIDER_REDIRECT_URI;
    delete process.env.OAUTH_APP_RETURN_URIS;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    restoreEnv("AUTH_TOKEN_SECRET", originalSecret);
    restoreEnv("AUTH_ALLOW_DEV_FALLBACK", originalDevFallback);
    restoreEnv("APPLE_OAUTH_CLIENT_ID", originalAppleClientId);
    restoreEnv("GOOGLE_OAUTH_CLIENT_ID", originalGoogleClientId);
    restoreEnv("GOOGLE_OAUTH_CLIENT_SECRET", originalGoogleClientSecret);
    restoreEnv("NAVER_OAUTH_CLIENT_ID", originalNaverClientId);
    restoreEnv("NAVER_OAUTH_CLIENT_SECRET", originalNaverClientSecret);
    restoreEnv("OAUTH_PROVIDER_REDIRECT_URI", originalOAuthProviderRedirect);
    restoreEnv("OAUTH_APP_RETURN_URIS", originalOAuthAppReturnUris);
    restoreEnv("NODE_ENV", originalNodeEnv);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("still signs bearer tokens for legacy anonymous users (endpoint closed)", async () => {
    // HTTP POST /auth/anonymous is gone; service helper remains for merge/JWT tests.
    const service = createAuthService();
    const session = await service.issueAnonymousSession();

    const user = service.verifyAccessToken(session.accessToken);

    expect(session.user.id).toMatch(/^anon_/);
    expect(session.refreshToken).toBeTruthy();
    expect(user.ownerKey).toBe(session.user.id);
    expect(user.accountType).toBe(AccountType.anonymous);
    expect(user.tokenKind).toBe("access");
  });

  it("rejects a tampered token", async () => {
    const service = createAuthService();
    const session = await service.issueAnonymousSession();
    const tamperedToken = `${session.accessToken.slice(0, -1)}x`;

    expect(() => service.verifyAccessToken(tamperedToken)).toThrow(
      UnauthorizedException,
    );
  });

  it("keeps the dev fallback disabled unless explicitly enabled", () => {
    const service = createAuthService();

    expect(service.getDevFallbackUser()).toBeNull();
  });

  it("allows the dev fallback only when explicitly enabled outside production", () => {
    process.env.AUTH_ALLOW_DEV_FALLBACK = "true";
    process.env.NODE_ENV = "development";
    const service = createAuthService();

    expect(service.getDevFallbackUser()).toMatchObject({
      role: UserRole.admin,
      accountType: AccountType.registered,
      tokenKind: "dev",
    });
  });

  it("blocks the dev fallback in production even when explicitly enabled", () => {
    process.env.AUTH_ALLOW_DEV_FALLBACK = "true";
    process.env.NODE_ENV = "production";
    const service = createAuthService();

    expect(service.getDevFallbackUser()).toBeNull();
  });

  it("requires a server-issued OAuth state before Google code exchange", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID =
      "google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    const service = createAuthService();

    await expect(
      service.oauthLogin(OAuthProvider.google, {
        providerToken: "code",
        redirectUri: "https://example.com/oauth/callback",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("requires the Naver OAuth client id only after a valid authorization session", async () => {
    const { service } = createOAuthAuthService();
    await expect(
      service.oauthLogin(OAuthProvider.naver, {
        providerToken: "code",
        state: "missing-session",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects startOAuth when returnUri is outside the allowlist", async () => {
    process.env.OAUTH_PROVIDER_REDIRECT_URI =
      "https://api.example.com/oauth/callback";
    process.env.OAUTH_APP_RETURN_URIS = "expirymate://oauth";
    const { service } = createOAuthAuthService();

    await expect(
      service.startOAuthAuthorization({
        provider: "google",
        returnUri: "https://auth.expo.io/@attacker/app",
      }),
    ).rejects.toThrow(/소셜 로그인/);
  });

  it("issues opaque state and PKCE challenge for allowlisted returnUri", async () => {
    process.env.OAUTH_PROVIDER_REDIRECT_URI =
      "https://api.example.com/oauth/callback";
    process.env.OAUTH_APP_RETURN_URIS = "expirymate://oauth";
    const { service, prisma } = createOAuthAuthService();

    const started = await service.startOAuthAuthorization({
      provider: "kakao",
      returnUri: "expirymate://oauth",
    });

    expect(started.state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(started.codeChallengeMethod).toBe("S256");
    expect(started.codeChallenge).toHaveLength(43);
    expect(started.redirectUri).toBe("https://api.example.com/oauth/callback");
    expect(prisma.oAuthAuthorizationSession.create).toHaveBeenCalledOnce();
  });

  it("marks authorization redirected once and rejects unknown state", async () => {
    process.env.OAUTH_APP_RETURN_URIS = "expirymate://oauth";
    const session = {
      id: "oas_1",
      state: "good-state",
      provider: OAuthProvider.google,
      returnUri: "expirymate://oauth",
      redirectUri: "https://api.example.com/oauth/callback",
      codeVerifier: "verifier",
      expiresAt: new Date(Date.now() + 60_000),
      redirectedAt: null as Date | null,
      consumedAt: null as Date | null,
    };
    const { service, prisma } = createOAuthAuthService({
      authorizationSession: session,
    });

    await expect(
      service.markOAuthAuthorizationRedirected("missing"),
    ).resolves.toBeNull();

    const first = await service.markOAuthAuthorizationRedirected("good-state");
    expect(first).toEqual({
      state: "good-state",
      returnUri: "expirymate://oauth",
      provider: OAuthProvider.google,
    });
    expect(prisma.oAuthAuthorizationSession.update).toHaveBeenCalledWith({
      where: { id: "oas_1" },
      data: { redirectedAt: expect.any(Date) },
    });

    session.redirectedAt = new Date();
    const second = await service.markOAuthAuthorizationRedirected("good-state");
    expect(second?.state).toBe("good-state");
    expect(prisma.oAuthAuthorizationSession.update).toHaveBeenCalledTimes(1);
  });

  it("rejects OAuth login when authorization state was already consumed", async () => {
    process.env.OAUTH_APP_RETURN_URIS = "expirymate://oauth";
    const { service } = createOAuthAuthService({
      authorizationSession: {
        id: "oas_used",
        state: "used-state",
        provider: OAuthProvider.google,
        returnUri: "expirymate://oauth",
        redirectUri: "https://api.example.com/oauth/callback",
        codeVerifier: "verifier",
        expiresAt: new Date(Date.now() + 60_000),
        redirectedAt: new Date(),
        consumedAt: new Date(),
      },
    });

    await expect(
      service.oauthLogin(OAuthProvider.google, {
        providerToken: "code",
        state: "used-state",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects malformed Apple OAuth tokens as unauthorized", async () => {
    process.env.APPLE_OAUTH_CLIENT_ID = "com.expirymate.test";
    const service = createAuthService();

    await expect(
      service.oauthLogin(OAuthProvider.apple, {
        providerToken: "not.jwt.signature",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("ignores client-supplied Apple email when the id_token has no email claim", async () => {
    process.env.APPLE_OAUTH_CLIENT_ID = "com.expirymate.test";
    const { privateKey, publicJwk } = createAppleTestKeys();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("appleid.apple.com/auth/keys")) {
        return {
          ok: true,
          json: async () => ({
            keys: [{ ...publicJwk, kid: "test-kid", alg: "RS256", use: "sig" }],
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const createdUser = makeUser({
      id: "user_apple_no_email",
      email: null,
      emailVerifiedAt: null,
    });
    const { service, prisma } = createOAuthAuthService({ createdUser });
    const providerToken = signAppleIdToken(
      privateKey,
      {
        sub: "apple.user.sub",
        aud: "com.expirymate.test",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "test-kid",
    );

    const session = await service.oauthLogin(OAuthProvider.apple, {
      providerToken,
      email: "victim@example.com",
      displayName: "공격자",
    });

    expect(session.user.id).toBe("user_apple_no_email");
    expect(prisma.user.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "victim@example.com" },
      }),
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: undefined,
          displayName: "공격자",
          emailVerifiedAt: undefined,
          oauthAccounts: {
            create: {
              provider: OAuthProvider.apple,
              providerUserId: "apple.user.sub",
              email: undefined,
            },
          },
        }),
      }),
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not auto-link a new OAuth identity to an existing email account", async () => {
    const victim = makeUser({
      id: "user_victim",
      email: "victim@example.com",
      emailVerifiedAt: new Date(),
    });
    const { service, prisma } = createOAuthAuthService({
      existingEmailUser: victim,
    });
    vi.spyOn(service as never, "verifyOAuthProfile" as never).mockResolvedValue({
      provider: OAuthProvider.apple,
      providerUserId: "apple.attacker.sub",
      email: "victim@example.com",
      emailVerified: true,
    } as never);

    await expect(
      service.oauthLogin(OAuthProvider.apple, {
        providerToken: "ignored",
        email: "victim@example.com",
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.refreshSession.create).not.toHaveBeenCalled();
  });

  it("still creates a new OAuth user when the signed email is unused", async () => {
    const createdUser = makeUser({
      id: "user_apple_new",
      email: "fresh@example.com",
      emailVerifiedAt: new Date(),
    });
    const { service, prisma } = createOAuthAuthService({ createdUser });
    vi.spyOn(service as never, "verifyOAuthProfile" as never).mockResolvedValue({
      provider: OAuthProvider.apple,
      providerUserId: "apple.fresh.sub",
      email: "fresh@example.com",
      displayName: "새 유저",
      emailVerified: true,
    } as never);

    const session = await service.oauthLogin(OAuthProvider.apple, {
      providerToken: "ignored",
    });

    expect(session.user.id).toBe("user_apple_new");
    expect(prisma.user.create).toHaveBeenCalledOnce();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rotates a refresh token only once under concurrent CAS", async () => {
    const user = makeUser({
      id: "user_refresh",
      email: "refresh@example.com",
      emailVerifiedAt: new Date(),
    });
    let casWins = 0;
    const updateMany = vi.fn(async () => {
      casWins += 1;
      return { count: casWins === 1 ? 1 : 0 };
    });
    const create = vi.fn(async () => ({}));
    const prisma = {
      refreshSession: {
        findUnique: vi.fn(async () => ({
          id: "rs_1",
          userId: user.id,
          tokenHash: "unused",
          revokedAt: null,
          replacedByTokenHash: null,
          expiresAt: new Date(Date.now() + 60_000),
          user,
        })),
        updateMany,
        create,
      },
      passwordCredential: {
        findUnique: vi.fn(async () => ({ userId: user.id })),
      },
      $transaction: vi.fn(async (fn: (tx: {
        refreshSession: { updateMany: typeof updateMany; create: typeof create };
      }) => Promise<unknown>) =>
        fn({ refreshSession: { updateMany, create } }),
      ),
    };
    const service = new AuthService(prisma as never, {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    } as never);

    const winner = await service.refresh("refresh-token-raw");
    await expect(service.refresh("refresh-token-raw")).rejects.toThrow(
      UnauthorizedException,
    );

    expect(winner.refreshToken).toBeTruthy();
    expect(create).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it("revokes the refresh family when a rotated token is reused", async () => {
    const user = makeUser({
      id: "user_reuse",
      email: "reuse@example.com",
      emailVerifiedAt: new Date(),
    });
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const prisma = {
      refreshSession: {
        findUnique: vi.fn(async () => ({
          id: "rs_old",
          userId: user.id,
          tokenHash: "old-hash",
          revokedAt: new Date(),
          replacedByTokenHash: "next-hash",
          expiresAt: new Date(Date.now() + 60_000),
          user,
        })),
        updateMany,
        create: vi.fn(),
      },
      passwordCredential: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const service = new AuthService(prisma as never, {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    } as never);

    await expect(service.refresh("old-refresh-token")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("registers without issuing a session and requires email verification", async () => {
    const mailService = {
      sendEmailVerification: vi.fn(async () => undefined),
      sendPasswordReset: vi.fn(async () => undefined),
    };
    const { service } = createRegisterableAuthService({ mailService });

    const result = await service.register({
      email: "new@example.com",
      password: "password123",
    });

    expect(result).toEqual({
      requiresEmailVerification: true,
      email: "new@example.com",
    });
    expect(mailService.sendEmailVerification).toHaveBeenCalledOnce();
  });

  it("resends verification instead of conflicting for unverified emails", async () => {
    const mailService = {
      sendEmailVerification: vi.fn(async () => undefined),
      sendPasswordReset: vi.fn(async () => undefined),
    };
    const existingUser = makeUser({
      id: "user_unverified",
      email: "pending@example.com",
      emailVerifiedAt: null,
      displayName: "원주인",
    });
    const { service, prisma } = createRegisterableAuthService({
      mailService,
      existingUser: {
        ...existingUser,
        passwordCredential: { passwordHash: "old-hash" },
      },
    });

    const result = await service.register({
      email: "pending@example.com",
      password: "password123",
    });

    expect(result).toEqual({
      requiresEmailVerification: true,
      email: "pending@example.com",
    });
    expect(mailService.sendEmailVerification).toHaveBeenCalledOnce();
    expect(prisma.passwordCredential.update).not.toHaveBeenCalled();
    expect(prisma.passwordCredential.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not overwrite an unverified account password on re-register", async () => {
    const mailService = {
      sendEmailVerification: vi.fn(async () => undefined),
      sendPasswordReset: vi.fn(async () => undefined),
    };
    const existingUser = makeUser({
      id: "user_unverified",
      email: "pending@example.com",
      emailVerifiedAt: null,
    });
    const { service, prisma } = createRegisterableAuthService({
      mailService,
      existingUser: {
        ...existingUser,
        passwordCredential: { passwordHash: "victim-password-hash" },
      },
    });

    await service.register({
      email: "Pending@example.com",
      password: "attacker-new-password",
      displayName: "공격자",
    });

    expect(prisma.passwordCredential.update).not.toHaveBeenCalled();
    expect(prisma.passwordCredential.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(mailService.sendEmailVerification).toHaveBeenCalledWith(
      "pending@example.com",
      expect.any(String),
    );
  });

  it("does not create a password on re-register when unverified user has none", async () => {
    const mailService = {
      sendEmailVerification: vi.fn(async () => undefined),
      sendPasswordReset: vi.fn(async () => undefined),
    };
    const existingUser = makeUser({
      id: "user_oauth_pending",
      email: "oauth-pending@example.com",
      emailVerifiedAt: null,
    });
    const { service, prisma } = createRegisterableAuthService({
      mailService,
      existingUser: {
        ...existingUser,
        passwordCredential: null,
      },
    });

    await service.register({
      email: "oauth-pending@example.com",
      password: "attacker-password",
    });

    expect(prisma.passwordCredential.create).not.toHaveBeenCalled();
    expect(prisma.passwordCredential.update).not.toHaveBeenCalled();
    expect(mailService.sendEmailVerification).toHaveBeenCalledOnce();
  });

  it("conflicts when registering an already verified email", async () => {
    const existingUser = makeUser({
      id: "user_verified",
      email: "done@example.com",
      emailVerifiedAt: new Date(),
    });
    const { service } = createRegisterableAuthService({
      existingUser: {
        ...existingUser,
        passwordCredential: { passwordHash: "hash" },
      },
    });

    await expect(
      service.register({
        email: "done@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("blocks login until email is verified", async () => {
    const passwordHash = await import("argon2").then((argon2) =>
      argon2.hash("password123"),
    );
    const existingUser = makeUser({
      id: "user_unverified",
      email: "pending@example.com",
      emailVerifiedAt: null,
    });
    const { service } = createRegisterableAuthService({
      existingUser: {
        ...existingUser,
        passwordCredential: { passwordHash },
      },
    });

    await expect(
      service.login({
        email: "pending@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("reports email verification status without revealing missing accounts", async () => {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            emailVerifiedAt: new Date(),
            deletedAt: null,
            mergedIntoUserId: null,
          })
          .mockResolvedValueOnce(null),
      },
    };
    const service = new AuthService(prisma as never, {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    } as never);

    await expect(
      service.getEmailVerificationStatus("done@example.com"),
    ).resolves.toEqual({ verified: true });
    await expect(
      service.getEmailVerificationStatus("missing@example.com"),
    ).resolves.toEqual({ verified: false });
  });

  it("confirms email on desktop without issuing a session", async () => {
    const user = makeUser({
      id: "user_desktop",
      email: "desktop@example.com",
      emailVerifiedAt: null,
    });
    const tokenRecord = {
      id: "ott_desktop",
      userId: user.id,
      tokenHash: "hash",
      purpose: OneTimeAuthTokenPurpose.email_verification,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const prisma = {
      user: {
        update: vi.fn(async () => ({
          ...user,
          emailVerifiedAt: new Date(),
        })),
      },
      oneTimeAuthToken: {
        findUnique: vi.fn(async () => tokenRecord),
        update: vi.fn(async () => ({ ...tokenRecord, consumedAt: new Date() })),
      },
      refreshSession: {
        create: vi.fn(async () => ({})),
      },
    };
    const service = new AuthService(prisma as never, {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    } as never);

    await expect(service.confirmEmailVerification("raw-token")).resolves.toEqual(
      { ok: true },
    );
    expect(prisma.refreshSession.create).not.toHaveBeenCalled();
  });

  it("issues a session after email verification", async () => {
    const user = makeUser({
      id: "user_verify",
      email: "verify@example.com",
      emailVerifiedAt: null,
    });
    const tokenRecord = {
      id: "ott_1",
      userId: user.id,
      tokenHash: "hash",
      purpose: OneTimeAuthTokenPurpose.email_verification,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const prisma = {
      user: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
        update: vi.fn(async (_args: { data: { emailVerifiedAt: Date } }) => ({
          ...user,
          emailVerifiedAt: new Date(),
        })),
      },
      passwordCredential: {
        update: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(async () => ({ userId: user.id })),
      },
    oneTimeAuthToken: {
      findUnique: vi.fn(async () => tokenRecord),
      update: vi.fn(async () => ({ ...tokenRecord, consumedAt: new Date() })),
      create: vi.fn(),
    },
      refreshSession: {
        create: vi.fn(async () => ({})),
        updateMany: vi.fn(),
      },
    };
    const service = new AuthService(prisma as never, {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    } as never);

    const session = await service.verifyEmail("raw-token");

    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.user.email).toBe("verify@example.com");
    expect(session.user.requiresEmailVerification).toBe(false);
  });
});

function makeUser(overrides: Partial<ReturnType<typeof baseUser>> = {}) {
  return {
    ...baseUser(),
    ...overrides,
  };
}

function baseUser() {
  return {
    id: "user_test",
    email: "test@example.com" as string | null,
    displayName: null as string | null,
    role: UserRole.user,
    accountType: AccountType.registered,
    emailVerifiedAt: null as Date | null,
    aiDataNoticeAcceptedAt: null,
    aiDataNoticeVersion: null,
    deletedAt: null,
    mergedIntoUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createAuthService() {
  const createdUser = {
    id: "anon_test-user",
    email: null,
    displayName: null,
    role: "user",
    accountType: "anonymous",
    emailVerifiedAt: null,
    aiDataNoticeAcceptedAt: null,
    aiDataNoticeVersion: null,
    deletedAt: null,
    mergedIntoUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return new AuthService(
    {
      user: {
        create: async () => createdUser,
      },
      refreshSession: {
        create: async () => ({}),
      },
    } as never,
    {} as never,
  );
}

function createRegisterableAuthService(options?: {
  mailService?: {
    sendEmailVerification: ReturnType<typeof vi.fn>;
    sendPasswordReset: ReturnType<typeof vi.fn>;
  };
  existingUser?: ReturnType<typeof makeUser> & {
    passwordCredential?: { passwordHash: string } | null;
  };
}) {
  const mailService = options?.mailService ?? {
    sendEmailVerification: vi.fn(async () => undefined),
    sendPasswordReset: vi.fn(async () => undefined),
  };
  const createdUser = makeUser({
    id: "user_new",
    email: "new@example.com",
  });

  const prisma = {
    user: {
      findUnique: vi.fn(async () => options?.existingUser ?? null),
      create: vi.fn(async () => createdUser),
      update: vi.fn(async () => options?.existingUser ?? createdUser),
    },
    passwordCredential: {
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
      findUnique: vi.fn(async () =>
        options?.existingUser?.passwordCredential
          ? { userId: options.existingUser.id }
          : null,
      ),
    },
    oneTimeAuthToken: {
      create: vi.fn(async () => ({})),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    refreshSession: {
      create: vi.fn(async () => ({})),
      updateMany: vi.fn(),
    },
  };

  return {
    service: new AuthService(prisma as never, mailService as never),
    prisma,
    mailService,
  };
}

function createOAuthAuthService(options?: {
  createdUser?: ReturnType<typeof makeUser>;
  existingEmailUser?: ReturnType<typeof makeUser> | null;
  existingOAuthUser?: ReturnType<typeof makeUser> | null;
  authorizationSession?: {
    id: string;
    state: string;
    provider: OAuthProvider;
    returnUri: string;
    redirectUri: string;
    codeVerifier: string;
    expiresAt: Date;
    redirectedAt: Date | null;
    consumedAt: Date | null;
  } | null;
}) {
  const createdUser =
    options?.createdUser ??
    makeUser({
      id: "user_oauth_new",
      email: null,
    });

  const prisma = {
    oAuthAccount: {
      findUnique: vi.fn(async () =>
        options?.existingOAuthUser
          ? { user: options.existingOAuthUser }
          : null,
      ),
    },
    oAuthAuthorizationSession: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "oas_new",
        ...args.data,
      })),
      findUnique: vi.fn(async (args: { where: { state: string } }) => {
        if (
          options?.authorizationSession &&
          options.authorizationSession.state === args.where.state
        ) {
          return options.authorizationSession;
        }
        return null;
      }),
      update: vi.fn(async () => options?.authorizationSession ?? null),
    },
    user: {
      findUnique: vi.fn(async (args: { where: { email?: string; id?: string } }) => {
        if (args.where.email && options?.existingEmailUser?.email === args.where.email) {
          return options.existingEmailUser;
        }
        return null;
      }),
      create: vi.fn(async () => createdUser),
      update: vi.fn(async () => options?.existingEmailUser ?? createdUser),
    },
    refreshSession: {
      create: vi.fn(async () => ({})),
      updateMany: vi.fn(),
    },
  };

  return {
    service: new AuthService(prisma as never, {
      sendEmailVerification: vi.fn(),
      sendPasswordReset: vi.fn(),
    } as never),
    prisma,
  };
}

function createAppleTestKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({ format: "jwk" });

  return { privateKey, publicJwk };
}

function signAppleIdToken(
  privateKey: KeyObject,
  payload: Record<string, unknown>,
  kid: string,
) {
  const header = { alg: "RS256", kid, typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
