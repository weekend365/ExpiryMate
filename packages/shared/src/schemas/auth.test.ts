import { describe, expect, it } from "vitest";
import {
  authSessionSchema,
  EMAIL_NOT_VERIFIED_ERROR_CODE,
  registerPendingResponseSchema,
  registerResponseSchema,
} from "./auth";

describe("auth response schemas", () => {
  it("accepts a pending register response", () => {
    const parsed = registerPendingResponseSchema.parse({
      requiresEmailVerification: true,
      email: "user@example.com",
    });

    expect(parsed.requiresEmailVerification).toBe(true);
  });

  it("distinguishes pending register from a session", () => {
    const pending = registerResponseSchema.parse({
      requiresEmailVerification: true,
      email: "user@example.com",
    });
    const session = registerResponseSchema.parse({
      user: {
        id: "u1",
        role: "user",
        accountType: "registered",
        email: "user@example.com",
        requiresEmailVerification: false,
      },
      accessToken: "access",
      refreshToken: "refresh",
    });

    expect("requiresEmailVerification" in pending && pending.requiresEmailVerification).toBe(
      true,
    );
    expect(authSessionSchema.safeParse(session).success).toBe(true);
  });

  it("exports a stable unverified-login error code", () => {
    expect(EMAIL_NOT_VERIFIED_ERROR_CODE).toBe("EMAIL_NOT_VERIFIED");
  });
});
