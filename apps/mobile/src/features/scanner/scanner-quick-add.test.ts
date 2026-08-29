import { ExpirySource, StorageLocation, UnitCode } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  buildScannerQuickAddPayload,
  canQuickAddScannedProduct,
  resolveScannerQuickStorageLocation,
} from "./scanner-quick-add";

describe("scanner quick add", () => {
  it("allows quick save only for a reliable name and OCR expiry", () => {
    expect(
      canQuickAddScannedProduct({
        productLookupStatus: "success",
        productName: "서울우유",
        needsNameConfirmation: false,
        expirationDate: "2026-09-01",
      }),
    ).toBe(true);

    for (const input of [
      { productLookupStatus: "not-found" as const },
      { productName: "" },
      { needsNameConfirmation: true },
      { expirationDate: null },
    ]) {
      expect(
        canQuickAddScannedProduct({
          productLookupStatus: "success",
          productName: "서울우유",
          needsNameConfirmation: false,
          expirationDate: "2026-09-01",
          ...input,
        }),
      ).toBe(false);
    }
  });

  it("prefers a valid recent location and safely falls back", () => {
    const availableLocationKeys = [
      StorageLocation.FRIDGE,
      StorageLocation.FREEZER,
    ];

    expect(
      resolveScannerQuickStorageLocation({
        draftStorageLocation: StorageLocation.FREEZER,
        lastStorageLocation: StorageLocation.ROOM,
        availableLocationKeys,
      }),
    ).toBe(StorageLocation.FREEZER);
    expect(
      resolveScannerQuickStorageLocation({
        draftStorageLocation: "deleted_custom_location",
        lastStorageLocation: StorageLocation.FREEZER,
        availableLocationKeys,
      }),
    ).toBe(StorageLocation.FREEZER);
    expect(resolveScannerQuickStorageLocation({})).toBe(
      StorageLocation.FRIDGE,
    );
  });

  it("builds the one-item quick-save payload", () => {
    expect(
      buildScannerQuickAddPayload({
        productMasterId: " product-1 ",
        displayName: " 서울우유 ",
        brand: " 서울우유협동조합 ",
        quantity: 2,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: "2026-09-01",
      }),
    ).toEqual({
      productMasterId: "product-1",
      displayName: "서울우유",
      brand: "서울우유협동조합",
      quantity: 2,
      unit: "개",
      quantityBase: 2,
      unitCode: UnitCode.EA,
      storageLocation: StorageLocation.FRIDGE,
      expiryDate: "2026-09-01",
      expirySource: ExpirySource.OCR_DETECTED,
    });
  });
});
