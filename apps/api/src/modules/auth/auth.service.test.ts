import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AccountType, OAuthProvider, UserRole } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});

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

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
