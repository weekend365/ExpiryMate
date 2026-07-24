import { describe, expect, it } from "vitest";
import { parsePendingSpaceInvitation } from "./pending-invitation-storage";

describe("pending space invitation", () => {
  it("reads the legacy raw email token", () => {
    expect(parsePendingSpaceInvitation(" legacy-token ", true)).toEqual({
      version: 2,
      kind: "email",
      token: "legacy-token",
    });
  });

  it("reads a canonical code invitation", () => {
    expect(
      parsePendingSpaceInvitation(
        JSON.stringify({
          version: 2,
          kind: "code",
          code: "abcd-efgh",
        }),
      ),
    ).toEqual({
      version: 2,
      kind: "code",
      code: "ABCDEFGH",
    });
  });

  it("rejects invalid or unknown stored values", () => {
    expect(parsePendingSpaceInvitation("{")).toBeNull();
    expect(
      parsePendingSpaceInvitation(
        JSON.stringify({ version: 3, kind: "code", code: "ABCDEFGH" }),
      ),
    ).toBeNull();
    expect(
      parsePendingSpaceInvitation(
        JSON.stringify({ version: 2, kind: "code", code: "ABCD0FGH" }),
      ),
    ).toBeNull();
  });
});
