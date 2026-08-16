import { describe, expect, it } from "vitest";
import { ProductMasterSource } from "../enums/app-enums";
import {
  bumpCatalogConfidence,
  catalogConfidenceAfterApply,
  catalogConfidenceLabel,
  catalogNeedsNameConfirmation,
  initialCatalogConfidence,
  resolveCatalogConfidence,
} from "./catalog-confidence";

describe("catalog confidence", () => {
  it("starts official sources high and user contributions low", () => {
    expect(initialCatalogConfidence(ProductMasterSource.FOODSAFETY_API)).toBe(85);
    expect(initialCatalogConfidence(ProductMasterSource.OPEN_FOOD_FACTS)).toBe(60);
    expect(initialCatalogConfidence(ProductMasterSource.USER_CONTRIBUTED)).toBe(35);
  });

  it("asks for a name check only below the trusted threshold", () => {
    expect(catalogNeedsNameConfirmation(85)).toBe(false);
    expect(catalogNeedsNameConfirmation(70)).toBe(false);
    expect(catalogNeedsNameConfirmation(69)).toBe(true);
    expect(catalogNeedsNameConfirmation(35)).toBe(true);
  });

  it("raises stored confidence after a matching confirmation", () => {
    expect(bumpCatalogConfidence(35)).toBe(43);
    expect(bumpCatalogConfidence(97)).toBe(100);
  });

  it("lifts applied corrections to a trusted floor without lowering official rows", () => {
    expect(
      catalogConfidenceAfterApply(ProductMasterSource.USER_CONTRIBUTED, 35),
    ).toBe(70);
    expect(
      catalogConfidenceAfterApply(ProductMasterSource.FOODSAFETY_API, 85),
    ).toBe(85);
    expect(
      catalogConfidenceAfterApply(ProductMasterSource.OPEN_FOOD_FACTS, 60),
    ).toBe(75);
  });

  it("falls back to the source default when confidence is missing", () => {
    expect(
      resolveCatalogConfidence({
        source: ProductMasterSource.FOODSAFETY_API,
        confidence: null,
      }),
    ).toBe(85);
  });

  it("uses conversational labels for admin", () => {
    expect(catalogConfidenceLabel(85)).toBe("믿을 만해요");
    expect(catalogConfidenceLabel(55)).toBe("조금 확실해요");
    expect(catalogConfidenceLabel(35)).toBe("아직 덜 확실해요");
  });
});
