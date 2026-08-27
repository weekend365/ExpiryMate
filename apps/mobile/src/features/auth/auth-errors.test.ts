import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./auth-errors";

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
