import { describe, expect, it } from "vitest";
import { ProductMasterSource } from "../enums/app-enums";
import {
  catalogCorrectionThresholdFor,
  catalogCorrectionVoteKey,
  catalogIdentityDiffers,
  normalizeCatalogText,
  pickMostCommonCatalogText,
  resolveCatalogDisplayIdentity,
} from "./catalog-text";

describe("catalog identity", () => {
  it("treats whitespace and casing as the same name", () => {
    expect(normalizeCatalogText("  서울  우유 ")).toBe("서울 우유");
    expect(
      catalogIdentityDiffers(
        { name: "서울우유 1L", brand: "서울우유" },
        { name: "  서울우유 1L  ", brand: "서울우유" },
      ),
    ).toBe(false);
  });

  it("detects a corrected product name", () => {
    expect(
      catalogIdentityDiffers(
        { name: "우유", brand: "서울우유", category: "dairy" },
        { name: "서울우유 1L", brand: "서울우유" },
      ),
    ).toBe(true);
  });

  it("ignores an empty brand or category as a non-correction", () => {
    expect(
      catalogIdentityDiffers(
        { name: "서울우유 1L", brand: "서울우유", category: "dairy" },
        { name: "서울우유 1L", brand: "", category: undefined },
      ),
    ).toBe(false);
  });

  it("compares against the crowd-facing name when one exists", () => {
    expect(
      catalogIdentityDiffers(
        resolveCatalogDisplayIdentity({
          name: "우유",
          brand: "서울우유",
          category: "dairy",
          crowdName: "서울우유 1L",
        }),
        { name: "서울우유 1L" },
      ),
    ).toBe(false);
  });

  it("uses a lower threshold for user-contributed catalog rows", () => {
    expect(
      catalogCorrectionThresholdFor(ProductMasterSource.USER_CONTRIBUTED),
    ).toBe(2);
    expect(
      catalogCorrectionThresholdFor(ProductMasterSource.FOODSAFETY_API),
    ).toBe(3);
    expect(catalogCorrectionVoteKey("  서울우유  1L ")).toBe("서울우유 1l");
  });

  it("picks the most common provided brand", () => {
    expect(
      pickMostCommonCatalogText(["서울우유", "서울우유", "매일우유", null]),
    ).toBe("서울우유");
  });
});
