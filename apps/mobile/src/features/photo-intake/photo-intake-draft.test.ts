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
  prioritizePhotoIntakeDrafts,
} from "./photo-intake-draft";

const milk: InventoryPhotoParseCandidate = {
  displayName: "서울우유",
  quantity: 2,
  unitCode: UnitCode.EA,
  confidence: 0.9,
  needsReview: true,
};

describe("photo intake drafts", () => {
  it("blocks submit until a low-confidence row has a date and is reviewed", () => {
    const drafts = candidatesToDrafts([milk], StorageLocation.FRIDGE);
    expect(canSubmitPhotoIntake(drafts)).toBe(false);
    expect(photoIntakeReadyCount(drafts)).toBe(0);

    const dated = applyExpiryToAll(drafts, "2026-09-01", ExpirySource.PRESET);
    expect(canSubmitPhotoIntake(dated)).toBe(false);
    expect(photoIntakeReadyCount(dated)).toBe(0);
    expect(draftsToCreateBody(dated)).toEqual([]);

    const reviewed = dated.map((item) => ({ ...item, needsReview: false }));
    expect(canSubmitPhotoIntake(reviewed)).toBe(true);
    expect(photoIntakeReadyCount(reviewed)).toBe(1);
    expect(draftsToCreateBody(reviewed)).toEqual([
      expect.objectContaining({
        displayName: "서울우유",
        quantity: 2,
        expiryDate: "2026-09-01",
        expirySource: ExpirySource.PRESET,
      }),
    ]);
  });

  it("puts missing and low-confidence rows before ready rows", () => {
    const drafts = candidatesToDrafts(
      [
        {
          displayName: "두부",
          confidence: 0.98,
          needsReview: false,
          suggestedExpiryDate: "2026-09-01",
        },
        {
          displayName: "우유",
          confidence: 0.6,
          needsReview: true,
          suggestedExpiryDate: "2026-09-02",
        },
        {
          displayName: "달걀",
          confidence: 0.95,
          needsReview: false,
        },
      ],
      StorageLocation.FRIDGE,
    );

    expect(prioritizePhotoIntakeDrafts(drafts).map((item) => item.displayName)).toEqual([
      "달걀",
      "우유",
      "두부",
    ]);
  });

  it("allows unknown expiry and saves ready rows without blocking on unfinished rows", () => {
    const drafts = candidatesToDrafts(
      [
        { displayName: "대파", confidence: 0.98, needsReview: false },
        { displayName: "두부", confidence: 0.4, needsReview: true },
      ],
      StorageLocation.FRIDGE,
    );
    const withUnknown = [
      {
        ...drafts[0]!,
        expiryDate: null,
        expirySource: ExpirySource.UNKNOWN,
      },
      drafts[1]!,
    ];

    expect(canSubmitPhotoIntake(withUnknown)).toBe(true);
    expect(photoIntakeReadyCount(withUnknown)).toBe(1);
    expect(draftsToCreateBody(withUnknown)).toEqual([
      expect.objectContaining({
        displayName: "대파",
        expiryDate: null,
        expirySource: ExpirySource.UNKNOWN,
      }),
    ]);
  });
});
