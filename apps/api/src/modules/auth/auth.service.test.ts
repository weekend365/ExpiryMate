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
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.AUTH_TOKEN_SECRET = "test-auth-token-secret";
    delete process.env.AUTH_ALLOW_DEV_FALLBACK;
    delete process.env.APPLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.NAVER_OAUTH_CLIENT_ID;
    delete process.env.NAVER_OAUTH_CLIENT_SECRET;
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
    restoreEnv("NODE_ENV", originalNodeEnv);
  });

  it("issues and verifies an anonymous bearer session", async () => {
    const service = createAuthService();
    const session = await service.issueAnonymousSession();

    const user = service.verifyAccessToken(session.accessToken);

    expect(session.user.id).toMatch(/^anon_/);
    expect(session.refreshToken).toBeTruthy();
    expect(user.ownerKey).toBe(session.user.id);
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

  it("requires the Google OAuth client id before code exchange", async () => {
    const service = createAuthService();

    await expect(
      service.oauthLogin(OAuthProvider.google, {
        providerToken: "code",
        redirectUri: "https://example.com/oauth/callback",
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("requires the Google OAuth client secret before code exchange", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID =
      "google-client-id.apps.googleusercontent.com";
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const service = createAuthService();

    await expect(
      service.oauthLogin(OAuthProvider.google, {
        providerToken: "code",
        redirectUri: "https://example.com/oauth/callback",
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("requires the Naver OAuth client id before code exchange", async () => {
    const service = createAuthService();

    await expect(
      service.oauthLogin(OAuthProvider.naver, { providerToken: "code" }),
    ).rejects.toThrow(ServiceUnavailableException);
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
    });
    const { service } = createRegisterableAuthService({
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
    email: "test@example.com",
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

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
