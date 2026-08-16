import { describe, expect, it } from "vitest";
import { catalogIdentityDiffers, normalizeCatalogText } from "./catalog-text";

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
});
