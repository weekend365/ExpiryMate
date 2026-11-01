import {
  ExpirySource,
  StorageLocation,
  UnitCode,
  type InventoryPhotoParseCandidate,
} from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  canSubmitPhotoIntake,
  photoIntakeCanMerge,
  photoIntakeDuplicateMessage,
  candidatesToDrafts,
  draftsToCreateBody,
  findPhotoIntakeDuplicateMatches,
  mergePhotoIntakeDraftItems,
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

    const dated = drafts.map((item) => ({
      ...item,
      expiryDate: "2026-09-01",
      expirySource: ExpirySource.PRESET,
    }));
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

  it("merges a repeated photo result into the first draft", () => {
    const drafts = candidatesToDrafts(
      [
        { displayName: "우유", brand: "서울", quantity: 1, confidence: 0.9, needsReview: false, expirySource: ExpirySource.UNKNOWN },
        { displayName: "우유", brand: "서울", quantity: 1, confidence: 0.9, needsReview: false, expirySource: ExpirySource.UNKNOWN },
      ],
      StorageLocation.FRIDGE,
    );

    const merged = mergePhotoIntakeDraftItems(
      drafts,
      drafts[1]!.localId,
      drafts[0]!.localId,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(2);
  });

  it("distinguishes an existing duplicate from a repeated photo row", () => {
    const drafts = candidatesToDrafts(
      [
        { displayName: " 우 유 ", quantity: 1, confidence: 0.9, needsReview: false },
        { displayName: "우유", quantity: 2, confidence: 0.9, needsReview: false },
      ],
      StorageLocation.FRIDGE,
    );

    const repeated = findPhotoIntakeDuplicateMatches(drafts, []);
    expect(repeated.get(drafts[0]!.localId)).toBeUndefined();
    expect(repeated.get(drafts[1]!.localId)).toEqual(
      expect.objectContaining({
        kind: "draft",
        targetLocalId: drafts[0]!.localId,
      }),
    );

    const existing = findPhotoIntakeDuplicateMatches([drafts[0]!], [
      {
        id: "inventory-1",
        displayName: "우유",
        quantity: 1,
        unit: undefined,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: null,
      },
    ]);
    expect(existing.get(drafts[0]!.localId)).toEqual(
      expect.objectContaining({ kind: "inventory" }),
    );
  });
  const ready = (extra = {}) => ({
    ...candidatesToDrafts([{ displayName: "우유 500ml", brand: "서울", confidence: 0.9, needsReview: false }], StorageLocation.FRIDGE)[0]!,
    expirySource: ExpirySource.UNKNOWN, ...extra,
  });

  it("excludes different known brands, package sizes, display or canonical units", () => {
    const draft = ready();
    for (const patch of [{brand: "매일"}, {displayName: "우유 1L"}, {unit: "병"}, {unitCode: UnitCode.ML}, {expiryDate: "2026-11-02"}, {storageLocation: StorageLocation.FREEZER}]) {
      expect(findPhotoIntakeDuplicateMatches([draft], [{...draft, id: "stored", ...patch}]).size).toBe(0);
    }
    expect(findPhotoIntakeDuplicateMatches([ready({unit: "kg", unitCode: UnitCode.G})], [{...ready({unit:"g",unitCode:UnitCode.G}),id:"g"}]).size).toBe(0);
  });

  it("prefers confirmed information over an unknown-brand possible match", () => {
    const draft = ready();
    const match = findPhotoIntakeDuplicateMatches([draft], [{...draft, brand: undefined, id:"unknown"}, {...draft,id:"exact"}]).get(draft.localId)!;
    expect(match).toMatchObject({kind:"inventory",strength:"exact",target:{id:"exact"}});
    expect(photoIntakeDuplicateMessage(match)).toBe("보관함에 같은 정보의 항목이 있어요");
    const possible = findPhotoIntakeDuplicateMatches([draft], [{...draft, brand: undefined,id:"unknown"}]).get(draft.localId)!;
    expect(possible.strength).toBe("possible");
    expect(photoIntakeDuplicateMessage(possible)).toContain("참고만");
    expect(canSubmitPhotoIntake([draft])).toBe(true);
  });

  it("requires content review and completeness on both sides of a draft merge", () => {
    const target=ready({localId:"target"});
    const source=ready({localId:"source"});
    expect(photoIntakeCanMerge(source,target)).toBe(true);
    for (const patch of [{needsReview:true},{expirySource:ExpirySource.MANUAL},{unit:"ml",unitCode:UnitCode.ML}]) {
      const drafts=[target,{...source,...patch}];
      expect(mergePhotoIntakeDraftItems(drafts,"source","target")).toBe(drafts);
    }
    const drafts=[{...target,needsReview:true},source];
    expect(mergePhotoIntakeDraftItems(drafts,"source","target")).toBe(drafts);
  });

  it("retains canonical volume when the model omitted the display unit", () => {
    const draft=ready({...candidatesToDrafts([{displayName:"우유",quantity:500,unitCode:UnitCode.ML,confidence:.9,needsReview:false}],StorageLocation.FRIDGE)[0]!,expirySource:ExpirySource.UNKNOWN});
    expect(draft.unit).toBe("ml");
    expect(draftsToCreateBody([draft])[0]).toMatchObject({quantityBase:500,unitCode:UnitCode.ML});
  });

  it.each([undefined, "", "미상", "브랜드 불명", "알 수 없음", "unknown"])("treats an unclear brand %s as advisory", (brand) => {
    const draft=ready({brand});
    const match=findPhotoIntakeDuplicateMatches([draft],[{...draft,id:"stored"}]).get(draft.localId)!;
    expect(match.strength).toBe("possible");
    expect(canSubmitPhotoIntake([draft])).toBe(true);
  });

  it("separates an exact repeated photo row from an existing inventory duplicate", () => {
    const first=ready({localId:"first"}),second=ready({localId:"second"});
    const match=findPhotoIntakeDuplicateMatches([first,second],[]).get("second")!;
    expect(match).toMatchObject({kind:"draft",targetLocalId:"first",strength:"exact"});
    expect(photoIntakeDuplicateMessage(match)).toBe("사진 결과에 같은 항목이 반복됐어요");
    expect(findPhotoIntakeDuplicateMatches([first,ready({localId:"other",brand:"매일"})],[]).size).toBe(0);
  });
  it("never sums a display unit contradicting the canonical unit, even on both sides", () => {
    const source=ready({unit:"ml",unitCode:UnitCode.EA});
    expect(photoIntakeCanMerge(source,{...source})).toBe(false);
  });

});
