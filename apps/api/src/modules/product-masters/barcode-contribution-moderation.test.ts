import { describe, expect, it } from "vitest";
import {
  findProhibitedBarcodeContributionFields,
  toNormalizedModerationText,
} from "./barcode-contribution-moderation";

describe("barcode contribution moderation", () => {
  it("allows ordinary product data and legitimate compound exceptions", () => {
    expect(
      findProhibitedBarcodeContributionFields({
        name: "서울우유 1L",
        brand: "서울우유",
        category: "dairy",
      }),
    ).toEqual([]);
    expect(
      findProhibitedBarcodeContributionFields({ name: "시발점" }),
    ).toEqual([]);
  });

  it.each([
    "씨발",
    "씨 발",
    "씨-발",
    "씨\u200B발",
    "ㅆㅣㅂㅏㄹ",
    "ㅅ ㅂ",
    "ＦＵＣＫ",
    "f.u.c.k",
    "fuuuck",
    "sh1t",
  ])("blocks normalized and obfuscated token terms: %s", (name) => {
    expect(findProhibitedBarcodeContributionFields({ name })).toEqual([
      "name",
    ]);
  });

  it("reports every rejected field without returning matched terms", () => {
    expect(
      findProhibitedBarcodeContributionFields({
        name: "정상 상품",
        brand: "포르노브랜드",
        category: "bitch",
      }),
    ).toEqual(["brand", "category"]);
  });

  it.each([
    "니애미라고 적은 브랜드",
    "야설모음",
    "펠라치오상품",
    "p0rn-site",
    "motherfucker-brand",
  ])("blocks expanded abusive and explicit expressions: %s", (brand) => {
    expect(findProhibitedBarcodeContributionFields({ brand })).toEqual([
      "brand",
    ]);
  });

  it("adds exact environment block terms and full-field allow values", () => {
    const env = {
      BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS: "운영금지어",
      BARCODE_CONTRIBUTION_ALLOWED_TERMS: "허용 브랜드",
    };

    expect(
      findProhibitedBarcodeContributionFields(
        { name: "운영-금지어", brand: "허용 브랜드" },
        env,
      ),
    ).toEqual(["name"]);
    expect(
      findProhibitedBarcodeContributionFields(
        { name: "허용 브랜드" },
        {
          ...env,
          BARCODE_CONTRIBUTION_EXTRA_BLOCKED_TERMS: "허용 브랜드",
        },
      ),
    ).toEqual([]);
  });

  it("normalizes unicode, case, punctuation, symbols, and zero-width text", () => {
    expect(toNormalizedModerationText(" Ａ\u200B-B__C ")).toBe("a b c");
  });
});
