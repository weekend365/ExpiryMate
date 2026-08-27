import { BarcodeLookupSource } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  getScannerConfirmDescription,
  getScannerProductSourceLabel,
  shouldContributeScannedBarcode,
} from "./scanner-confirm-copy";

describe("scanner confirm copy", () => {
  it("keeps not-found copy when the catalog miss is explicit", () => {
    expect(
      getScannerConfirmDescription({
        needsManualName: true,
        needsManualExpiry: false,
        catalogNameAccepted: true,
        needsNameConfirmation: false,
        productLookupStatus: "not-found",
      }),
    ).toBe(
      "목록에서 못 찾았어요. 이름만 알려주시면 양 맞추는 화면으로 이어갈게요.",
    );
  });

  it("does not call a lookup outage a catalog miss", () => {
    expect(
      getScannerConfirmDescription({
        needsManualName: true,
        needsManualExpiry: true,
        catalogNameAccepted: true,
        needsNameConfirmation: false,
        productLookupStatus: "error",
      }),
    ).toBe(
      "상품 조회가 잠시 막혔어요. 이름과 유통기한을 알려주시면 양만 맞춰 넣을게요.",
    );
    expect(
      getScannerProductSourceLabel({
        productLookupStatus: "error",
        needsManualName: true,
      }),
    ).toBe("상품 정보를 불러오지 못했어요");
  });

  it("skips catalog contribution when lookup failed", () => {
    expect(shouldContributeScannedBarcode("not-found")).toBe(true);
    expect(shouldContributeScannedBarcode("error")).toBe(false);
  });

  it("keeps catalog source labels on a successful lookup", () => {
    expect(
      getScannerProductSourceLabel({
        productLookupStatus: "success",
        needsManualName: false,
        productSource: BarcodeLookupSource.PRODUCT_MASTER,
      }),
    ).toBe("우리 목록에서 찾았어요");
  });
});
