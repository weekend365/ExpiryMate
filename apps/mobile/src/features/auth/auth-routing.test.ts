import { describe, expect, it } from "vitest";
import { resolveRegisteredLandingHref } from "./auth-routing";

describe("resolveRegisteredLandingHref", () => {
  it("sends signed-out users to login", () => {
    expect(resolveRegisteredLandingHref({})).toBe("/auth/login");
    expect(
      resolveRegisteredLandingHref({ accountType: "anonymous" }),
    ).toBe("/auth/login");
  });

  it("sends unverified registered users to verify-pending", () => {
    expect(
      resolveRegisteredLandingHref({
        accountType: "registered",
        requiresEmailVerification: true,
        email: "user@example.com",
      }),
    ).toEqual({
      pathname: "/auth/verify-pending",
      params: { email: "user@example.com" },
    });
    expect(
      resolveRegisteredLandingHref({
        accountType: "registered",
        requiresEmailVerification: true,
      }),
    ).toBe("/auth/verify-pending");
  });

  it("sends verified registered users home", () => {
    expect(
      resolveRegisteredLandingHref({
        accountType: "registered",
        requiresEmailVerification: false,
      }),
    ).toBe("/(tabs)/home");
  });
});
