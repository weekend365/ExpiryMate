import { semanticColors, spacing } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  buildAuthBridgeDeepLink,
  buildDesktopVerifyEmailResultHtml,
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

  it("renders desktop success and failure without client fetch", () => {
    const ok = buildDesktopVerifyEmailResultHtml({ ok: true });
    expect(ok).toContain("메일 확인이 끝났어요");
    expect(ok).toContain("앱으로 돌아와 들어와 주세요");
    expect(ok).not.toContain("fetch(");

    const fail = buildDesktopVerifyEmailResultHtml({
      ok: false,
      message: "토큰이 만료되었거나 올바르지 않습니다.",
    });
    expect(fail).toContain("앗, 확인하지 못했어요");
    expect(fail).toContain("토큰이 만료되었거나 올바르지 않습니다.");
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
