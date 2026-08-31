import { describe, expect, it } from "vitest";
import {
  COOKING_SESSION_DRAFT_TTL_MS,
  decodeCookingSessionDraft,
  getCookingSessionDraftKey,
} from "./cooking-session-draft";

const now = Date.UTC(2026, 7, 31, 12);
const validDraft = {
  version: 1,
  updatedAt: now - 1_000,
  currentIndex: 2,
  checkedPrepKeys: ["milk-1"],
  completedCookingSteps: [0],
  consumptionChoices: {
    "milk-1": {
      mode: "recommended",
      amountBase: 500,
      selectedInventoryItemId: "milk-1",
    },
  },
};

describe("cooking session draft", () => {
  it("separates drafts by owner, space, recipe, and dish", () => {
    expect(getCookingSessionDraftKey("user:1", "space/1", "rec 1", 2)).toBe(
      "expirymate:cooking-session:v1:user%3A1:space%2F1:rec%201:2",
    );
  });

  it("restores a valid recent draft", () => {
    expect(decodeCookingSessionDraft(JSON.stringify(validDraft), now)).toEqual(
      validDraft,
    );
  });

  it("rejects expired, malformed, and future drafts", () => {
    expect(
      decodeCookingSessionDraft(
        JSON.stringify({
          ...validDraft,
          updatedAt: now - COOKING_SESSION_DRAFT_TTL_MS - 1,
        }),
        now,
      ),
    ).toBeNull();
    expect(
      decodeCookingSessionDraft(
        JSON.stringify({ ...validDraft, updatedAt: now + 1 }),
        now,
      ),
    ).toBeNull();
    expect(
      decodeCookingSessionDraft(
        JSON.stringify({ ...validDraft, currentIndex: -1 }),
        now,
      ),
    ).toBeNull();
    expect(decodeCookingSessionDraft("not-json", now)).toBeNull();
  });
});
