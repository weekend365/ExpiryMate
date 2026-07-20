import { describe, expect, it } from "vitest";
import {
  buildAuthBridgeDeepLink,
  buildAuthBridgeHtml,
} from "./auth-bridge";

describe("auth-bridge", () => {
  it("points verify-email CTA at the login deep link after browser verify", () => {
    process.env.APP_BASE_URL = "expirymate://";

    expect(buildAuthBridgeDeepLink("verify-email", "tok123")).toBe(
      "expirymate://auth/login",
    );
  });

  it("verifies email in the browser before offering the app login link", () => {
    process.env.APP_BASE_URL = "expirymate://";
    const html = buildAuthBridgeHtml("verify-email", "tok123");

    expect(html).toContain("/auth/email/verify");
    expect(html).toContain("tok123");
    expect(html).toContain("expirymate://auth/login");
    expect(html).toContain("메일 확인이 끝났어요");
  });

  it("embeds the reset-password deep link with token", () => {
    process.env.APP_BASE_URL = "expirymate://";
    const html = buildAuthBridgeHtml("reset-password", "abc");

    expect(html).toContain("expirymate://auth/reset-password?token=abc");
    expect(html).toContain("앱으로 이어갈게요");
  });
});
