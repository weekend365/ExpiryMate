import { describe, expect, it } from "vitest";
import {
  acceptSpaceInvitationCodeBodySchema,
  formatSpaceInvitationCode,
  isValidSpaceInvitationCode,
  normalizeSpaceInvitationCode,
  previewSpaceInvitationCodeBodySchema,
} from "./spaces";

describe("space invitation code", () => {
  it("normalizes lowercase, spaces, and hyphens", () => {
    expect(normalizeSpaceInvitationCode("abCD- efgh")).toBe("ABCDEFGH");
    expect(formatSpaceInvitationCode("abcd efgh")).toBe("ABCD-EFGH");
  });

  it("rejects ambiguous and malformed characters", () => {
    expect(isValidSpaceInvitationCode("ABCD-EFGH")).toBe(true);
    expect(isValidSpaceInvitationCode("ABCD-0FGH")).toBe(false);
    expect(isValidSpaceInvitationCode("ABC-EFGH")).toBe(false);
  });

  it("returns canonical codes from request schemas", () => {
    expect(
      previewSpaceInvitationCodeBodySchema.parse({ code: "abcd-efgh" }),
    ).toEqual({ code: "ABCDEFGH" });
    expect(
      acceptSpaceInvitationCodeBodySchema.parse({ code: "abcd efgh" }),
    ).toEqual({ code: "ABCDEFGH", notificationsEnabled: false });
  });
});
