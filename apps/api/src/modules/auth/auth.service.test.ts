import { UnauthorizedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const originalSecret = process.env.AUTH_TOKEN_SECRET;

  beforeEach(() => {
    process.env.AUTH_TOKEN_SECRET = "test-auth-token-secret";
  });

  afterEach(() => {
    process.env.AUTH_TOKEN_SECRET = originalSecret;
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
