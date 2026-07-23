import { describe, expect, it } from "vitest";
import { ExpirySource, StorageLocation } from "../enums/app-enums";
import { fieldLimits } from "../constants/field-limits";
import {
  createInventoryItemBodySchema,
  inventoryFormSchema,
} from "./inventory";
import { registerPushTokenSchema } from "./notifications";
import { contributeBarcodeProductSchema } from "./product-master";

describe("inventory write contracts", () => {
  const valid = {
    displayName: "서울우유",
    quantity: 1,
    storageLocation: StorageLocation.FRIDGE,
    expiryDate: "2026-07-30",
    expirySource: ExpirySource.MANUAL,
  };

  it("accepts a valid create body", () => {
    expect(createInventoryItemBodySchema.parse(valid)).toMatchObject({
      displayName: "서울우유",
      quantity: 1,
    });
  });

  it("rejects oversized display names", () => {
    const result = inventoryFormSchema.safeParse({
      ...valid,
      displayName: "x".repeat(fieldLimits.displayName + 1),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a custom storage location key string", () => {
    expect(
      createInventoryItemBodySchema.parse({
        ...valid,
        storageLocation: "custom_pantry",
      }).storageLocation,
    ).toBe("custom_pantry");
  });
});

describe("push token contract", () => {
  it("requires an Expo push token shape", () => {
    expect(
      registerPushTokenSchema.safeParse({ token: "not-a-token" }).success,
    ).toBe(false);
    expect(
      registerPushTokenSchema.parse({
        token: "ExponentPushToken[abc123]",
      }).platform,
    ).toBe("unknown");
  });
});

describe("barcode contribute contract", () => {
  it("requires numeric barcodes", () => {
    expect(
      contributeBarcodeProductSchema.safeParse({
        barcode: "ABC12345",
        name: "테스트",
      }).success,
    ).toBe(false);
    expect(
      contributeBarcodeProductSchema.parse({
        barcode: "8801234567890",
        name: "테스트 우유",
      }).barcode,
    ).toBe("8801234567890");
  });
});
