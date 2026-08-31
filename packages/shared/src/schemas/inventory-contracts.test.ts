import { describe, expect, it } from "vitest";
import { ExpirySource, StorageLocation, UnitCode } from "../enums/app-enums";
import { fieldLimits } from "../constants/field-limits";
import {
  createInventoryItemBodySchema,
  batchConsumeInventoryItemsBodySchema,
  batchCreateInventoryItemsBodySchema,
  inventoryFormSchema,
  inventoryPhotoParseCandidateSchema,
  inventoryPhotoParseAccessSchema,
  inventoryPhotoParseResponseSchema,
  inventoryPhotoParseVisionPayloadSchema,
} from "./inventory";
import { PHOTO_PARSE_MAX_ITEMS } from "../constants/field-limits";
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

  it("accepts an optional barcode catalog id", () => {
    expect(
      createInventoryItemBodySchema.parse({
        ...valid,
        productMasterId: "pm-milk",
      }).productMasterId,
    ).toBe("pm-milk");
  });

  it("accepts canonical quantity fields without requiring them from legacy clients", () => {
    expect(
      createInventoryItemBodySchema.parse({
        ...valid,
        unit: "L",
        quantityBase: 1000,
        unitCode: UnitCode.ML,
      }),
    ).toMatchObject({
      quantityBase: 1000,
      unitCode: UnitCode.ML,
    });
    expect(createInventoryItemBodySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects duplicate or fractional batch consumption", () => {
    expect(
      batchConsumeInventoryItemsBodySchema.safeParse({
        items: [
          { inventoryItemId: "milk-1", amountBase: 500 },
          { inventoryItemId: "milk-1", amountBase: 100 },
        ],
      }).success,
    ).toBe(false);
    expect(
      batchConsumeInventoryItemsBodySchema.safeParse({
        items: [{ inventoryItemId: "milk-1", amountBase: 0.5 }],
      }).success,
    ).toBe(false);
  });
});

describe("inventory photo parse access contract", () => {
  it("accepts the free plus rewarded daily quota response", () => {
    expect(
      inventoryPhotoParseAccessSchema.parse({
        day: "2026-08-28",
        timezone: "Asia/Seoul",
        resetsAt: "2026-08-28T15:00:00.000Z",
        canParse: false,
        requiredAction: "watch_ad",
        free: { limit: 1, used: 1, remaining: 0 },
        rewardedAds: {
          enabled: true,
          dailyLimit: 3,
          verified: 0,
          creditsAvailable: 0,
          remainingToWatch: 3,
          canWatch: true,
        },
      }).requiredAction,
    ).toBe("watch_ad");
  });

  it("accepts an explicitly unknown expiry and rejects missing known dates", () => {
    expect(
      createInventoryItemBodySchema.parse({
        displayName: "대파",
        quantity: 1,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: null,
        expirySource: ExpirySource.UNKNOWN,
      }).expiryDate,
    ).toBeNull();
    expect(
      createInventoryItemBodySchema.safeParse({
        displayName: "대파",
        quantity: 1,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: null,
        expirySource: ExpirySource.MANUAL,
      }).success,
    ).toBe(false);
  });
});

describe("photo parse contracts", () => {
  it("accepts a receipt candidate without expiry", () => {
    expect(
      inventoryPhotoParseCandidateSchema.parse({
        displayName: "서울우유",
        quantity: 2,
        unitCode: UnitCode.EA,
        confidence: 0.9,
        needsReview: false,
      }),
    ).toMatchObject({
      displayName: "서울우유",
      quantity: 2,
    });
  });

  it("rejects empty names and more than 30 items", () => {
    expect(
      inventoryPhotoParseCandidateSchema.safeParse({
        displayName: "  ",
        confidence: 0.5,
        needsReview: true,
      }).success,
    ).toBe(false);
    expect(
      inventoryPhotoParseResponseSchema.safeParse({
        scene: "receipt",
        items: Array.from({ length: PHOTO_PARSE_MAX_ITEMS + 1 }, (_, index) => ({
          displayName: `재료 ${index + 1}`,
          confidence: 0.4,
          needsReview: true,
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid suggested expiry date", () => {
    expect(
      inventoryPhotoParseCandidateSchema.safeParse({
        displayName: "우유",
        suggestedExpiryDate: "2026/08/01",
        confidence: 0.8,
        needsReview: false,
      }).success,
    ).toBe(false);
  });

  it("accepts a vision payload and a batch-create body", () => {
    expect(
      inventoryPhotoParseVisionPayloadSchema.parse({
        items: [
          {
            displayName: "우유",
            brand: null,
            category: null,
            quantity: 2,
            unit: "개",
            unitCode: UnitCode.EA,
            suggestedStorageLocation: "fridge",
            suggestedExpiryDate: null,
            confidence: 0.86,
            needsReview: false,
            reason: null,
          },
        ],
      }).items,
    ).toHaveLength(1);
    expect(
      batchCreateInventoryItemsBodySchema.parse({
        items: [
          {
            displayName: "서울우유",
            quantity: 1,
            storageLocation: StorageLocation.FRIDGE,
            expiryDate: "2026-07-30",
            expirySource: ExpirySource.MANUAL,
          },
        ],
      }).items,
    ).toHaveLength(1);
    expect(
      batchCreateInventoryItemsBodySchema.safeParse({ items: [] }).success,
    ).toBe(false);
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
