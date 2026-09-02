import { describe, expect, it } from "vitest";
import { ProductCategory, UnitCode } from "@expirymate/shared";
import { normalizePhotoParseItems } from "./inventory-photo-parse.normalize";

const visionItem = (
  overrides: Partial<Parameters<typeof normalizePhotoParseItems>[1][number]> = {},
) => ({
  displayName: "서울우유",
  brand: null,
  category: ProductCategory.DAIRY,
  quantity: 2,
  unit: "개",
  unitCode: UnitCode.EA,
  suggestedStorageLocation: "fridge",
  suggestedExpiryDate: null,
  confidence: 0.9,
  needsReview: false,
  reason: null,
  ...overrides,
});

describe("normalizePhotoParseItems", () => {
  it("keeps milk quantity and drops receipt totals and bags", () => {
    const items = normalizePhotoParseItems("receipt", [
      visionItem(),
      visionItem({ displayName: "합계", quantity: 1 }),
      visionItem({ displayName: "봉투", quantity: 1 }),
      visionItem({ displayName: "  " }),
    ]);

    expect(items.map((item) => item.displayName)).toEqual(["서울우유"]);
    expect(items[0]?.quantity).toBe(2);
    expect(items[0]?.needsReview).toBe(true);
  });

  it("marks fridge scenes as needing review", () => {
    const items = normalizePhotoParseItems("fridge", [
      visionItem({
        displayName: "계란",
        quantity: 1,
        category: ProductCategory.EGG,
        confidence: 0.8,
      }),
    ]);

    expect(items[0]?.needsReview).toBe(true);
  });

  it("keeps a visible expiry date and drops impossible years", () => {
    const kept = normalizePhotoParseItems("receipt", [
      visionItem({ suggestedExpiryDate: "2026-09-01" }),
    ]);
    const dropped = normalizePhotoParseItems("receipt", [
      visionItem({ suggestedExpiryDate: "1999-01-01" }),
    ]);

    expect(kept[0]?.suggestedExpiryDate).toBe("2026-09-01");
    expect(kept[0]?.expirySource).toBe("ocr_detected");
    expect(dropped[0]?.suggestedExpiryDate).toBeUndefined();
  });
});
