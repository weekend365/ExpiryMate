import { describe, expect, it } from "vitest";
import {
  getBarcodeContributionModerationMessage,
  getProhibitedBarcodeContributionFields,
  PROHIBITED_BARCODE_CONTRIBUTION_CODE,
} from "./barcodeContributionModeration";

describe("barcode contribution moderation errors", () => {
  it("extracts supported rejected fields in display order", () => {
    expect(
      getProhibitedBarcodeContributionFields({
        code: PROHIBITED_BARCODE_CONTRIBUTION_CODE,
        details: { fields: ["category", "unknown", "name"] },
      }),
    ).toEqual(["name", "category"]);
  });

  it("distinguishes unrelated API failures", () => {
    expect(
      getProhibitedBarcodeContributionFields({
        code: "NETWORK_ERROR",
        details: { fields: ["name"] },
      }),
    ).toBeNull();
  });

  it("builds a safe field-only message", () => {
    expect(getBarcodeContributionModerationMessage(["name", "brand"])).toBe(
      "상품명·브랜드에 사용할 수 없는 표현이 있어요. 문구를 수정하거나 기여 없이 계속해 주세요.",
    );
    expect(getBarcodeContributionModerationMessage([])).toContain("상품 정보");
  });
});
