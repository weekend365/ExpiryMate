import {
  ExpirySource,
  StorageLocation,
  UnitCode,
  type InventoryPhotoParseCandidate,
} from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  applyExpiryToAll,
  canSubmitPhotoIntake,
  candidatesToDrafts,
  draftsToCreateBody,
  photoIntakeReadyCount,
} from "./photo-intake-draft";

const milk: InventoryPhotoParseCandidate = {
  displayName: "서울우유",
  quantity: 2,
  unitCode: UnitCode.EA,
  confidence: 0.9,
  needsReview: true,
};

describe("photo intake drafts", () => {
  it("blocks submit while any row is missing an expiry date", () => {
    const drafts = candidatesToDrafts([milk], StorageLocation.FRIDGE);
    expect(canSubmitPhotoIntake(drafts)).toBe(false);
    expect(photoIntakeReadyCount(drafts)).toBe(0);

    const dated = applyExpiryToAll(drafts, "2026-09-01", ExpirySource.PRESET);
    expect(canSubmitPhotoIntake(dated)).toBe(true);
    expect(draftsToCreateBody(dated)).toEqual([
      expect.objectContaining({
        displayName: "서울우유",
        quantity: 2,
        expiryDate: "2026-09-01",
        expirySource: ExpirySource.PRESET,
      }),
    ]);
  });
});
