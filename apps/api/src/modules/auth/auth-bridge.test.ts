import { describe, expect, it } from "vitest";
import {
  buildAuthBridgeDeepLink,
  buildAuthBridgeHtml,
} from "./auth-bridge";

describe("auth-bridge", () => {
  it("builds verify-email deep links without a triple slash", () => {
    process.env.APP_BASE_URL = "expirymate://";

    expect(buildAuthBridgeDeepLink("verify-email", "tok123")).toBe(
      "expirymate://auth/verify-email?token=tok123",
    );
  });

  it("embeds the deep link in the HTML bridge", () => {
    process.env.APP_BASE_URL = "expirymate://";
    const html = buildAuthBridgeHtml("reset-password", "abc");

    expect(html).toContain("expirymate://auth/reset-password?token=abc");
    expect(html).toContain("앱으로 이어갈게요");
  });
});
