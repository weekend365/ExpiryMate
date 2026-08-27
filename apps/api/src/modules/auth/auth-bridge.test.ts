import { semanticColors, spacing } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  buildAuthBridgeDeepLink,
  buildDesktopVerifyEmailBridgeHtml,
  buildMobileVerifyEmailBridgeHtml,
  buildResetPasswordBridgeHtml,
  isMobileUserAgent,
} from "./auth-bridge";

describe("auth-bridge", () => {
  it("builds mobile verify deep links with token and no triple slash", () => {
    process.env.APP_BASE_URL = "expirymate://";

    expect(buildAuthBridgeDeepLink("verify-email", "tok123")).toBe(
      "expirymate://auth/verify-email?token=tok123",
    );

    const html = buildMobileVerifyEmailBridgeHtml("tok123");
    expect(html).toContain("expirymate://auth/verify-email?token=tok123");
    expect(html).toContain("앱으로 이어갈게요");
    expect(html).not.toContain("/auth/email/verify");
    expect(html).toContain(semanticColors.primary);
    expect(html).toContain(`padding: ${spacing.md}px`);
  });

  it("keeps the desktop verify token unused and asks to open on the phone", () => {
    process.env.APP_BASE_URL = "expirymate://";
    const html = buildDesktopVerifyEmailBridgeHtml("tok123");

    expect(html).toContain("expirymate://auth/verify-email?token=tok123");
    expect(html).toContain("휴대폰에서 이 링크를 다시 열어 주세요");
    expect(html).toContain("앱으로 이어갈게요");
    expect(html).not.toContain("메일 확인이 끝났어요");
    expect(html).not.toContain("가입이 끝난 상태예요");
    expect(html).not.toContain("/auth/email/verify");
  });

  it("detects mobile user agents", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      true,
    );
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      ),
    ).toBe(false);
  });

  it("embeds the reset-password deep link with token", () => {
    process.env.APP_BASE_URL = "expirymate://";
    const html = buildResetPasswordBridgeHtml("abc");

    expect(html).toContain("expirymate://auth/reset-password?token=abc");
    expect(html).toContain("앱으로 이어갈게요");
  });
});
