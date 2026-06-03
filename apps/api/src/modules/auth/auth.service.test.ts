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

  it("issues and verifies an anonymous bearer session", () => {
    const service = new AuthService();
    const session = service.issueAnonymousSession();

    const user = service.verifyBearerToken(session.accessToken);

    expect(session.tokenType).toBe("Bearer");
    expect(session.ownerKey).toMatch(/^anon_/);
    expect(user).toEqual({
      ownerKey: session.ownerKey,
      tokenKind: "anonymous",
    });
  });

  it("rejects a tampered token", () => {
    const service = new AuthService();
    const session = service.issueAnonymousSession();
    const tamperedToken = `${session.accessToken.slice(0, -1)}x`;

    expect(() => service.verifyBearerToken(tamperedToken)).toThrow(
      UnauthorizedException,
    );
  });
});
