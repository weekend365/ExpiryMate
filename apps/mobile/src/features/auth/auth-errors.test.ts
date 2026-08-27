import { describe, expect, it } from "vitest";
import { getAuthErrorMessage, isEmailNotVerifiedAuthError } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it("returns the Error message when present", () => {
    expect(getAuthErrorMessage(new Error("메일 확인이 아직이에요."))).toBe(
      "메일 확인이 아직이에요.",
    );
  });

  it("falls back for unknown values", () => {
    expect(getAuthErrorMessage("nope")).toBe(
      "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
    );
  });
});

describe("isEmailNotVerifiedAuthError", () => {
  it("matches the coded 403 contract instead of message text", () => {
    expect(
      isEmailNotVerifiedAuthError({
        code: "EMAIL_NOT_VERIFIED",
        message: "메일 확인이 아직이에요.",
      }),
    ).toBe(true);
    expect(
      isEmailNotVerifiedAuthError(
        new Error("메일 확인이 아직이에요. 받은편지함을 살펴봐 주세요."),
      ),
    ).toBe(false);
  });
});
