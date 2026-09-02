import { describe, expect, it } from "vitest";
import {
  ExpirySource,
  ItemStatus,
  StorageLocation,
  UnitCode,
} from "../enums/app-enums";
import { addDays, toIsoDate } from "./date";
import {
  getExpiryBucket,
  getExpiryTrafficBucket,
  groupInventoryItems,
} from "./inventory";

describe("inventory utils", () => {
  it("classifies expiry buckets correctly", () => {
    const now = new Date("2026-04-19T09:00:00.000Z");

    expect(getExpiryBucket(toIsoDate(addDays(now, -1)), now)).toBe("expired");
    expect(getExpiryBucket(toIsoDate(now), now)).toBe("today");
    expect(getExpiryBucket(toIsoDate(addDays(now, 2)), now)).toBe("within_3_days");
    expect(getExpiryBucket(toIsoDate(addDays(now, 6)), now)).toBe("within_7_days");
    expect(getExpiryBucket(toIsoDate(addDays(now, 10)), now)).toBe("safe");
    expect(getExpiryBucket(null, now)).toBe("unknown");
  });

  it("classifies mutually exclusive traffic-light boundaries", () => {
    const now = new Date("2026-04-19T09:00:00.000Z");

    expect(getExpiryTrafficBucket(toIsoDate(addDays(now, -1)), now)).toBe(
      "expired",
    );
    expect(getExpiryTrafficBucket(toIsoDate(now), now)).toBe("within_7_days");
    expect(getExpiryTrafficBucket(toIsoDate(addDays(now, 7)), now)).toBe(
      "within_7_days",
    );
    expect(getExpiryTrafficBucket(toIsoDate(addDays(now, 8)), now)).toBe(
      "safe",
    );
  });

  it("groups the same product while keeping its expiry lots", () => {
    const baseItem = {
      displayName: "얼큰한 너구리",
      brand: "농심",
      quantity: 1,
      unit: "개",
      quantityBase: 1,
      unitCode: UnitCode.EA,
      storageLocation: StorageLocation.ROOM,
      expirySource: ExpirySource.MANUAL,
      status: ItemStatus.ACTIVE,
      createdAt: "2026-04-19",
      updatedAt: "2026-04-19",
    };
    const groups = groupInventoryItems([
      { ...baseItem, id: "later", expiryDate: "2026-04-27" },
      { ...baseItem, id: "today", expiryDate: "2026-04-19" },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["today", "later"]);
    expect(groups[0]?.totalQuantity).toBe(2);
    expect(groups[0]?.nearestExpiryDate).toBe("2026-04-19");
  });

  it("does not group products with different stable product ids", () => {
    const baseItem = {
      displayName: "같은 표시 이름",
      quantity: 1,
      quantityBase: 1,
      unitCode: UnitCode.EA,
      storageLocation: StorageLocation.FRIDGE,
      expiryDate: "2026-04-19",
      expirySource: ExpirySource.MANUAL,
      status: ItemStatus.ACTIVE,
      createdAt: "2026-04-19",
      updatedAt: "2026-04-19",
    };
    const groups = groupInventoryItems([
      { ...baseItem, id: "1", productId: "product-a" },
      { ...baseItem, id: "2", productId: "product-b" },
    ]);

    expect(groups).toHaveLength(2);
  });

  it("groups barcode lots by catalog id even when names differ", () => {
    const baseItem = {
      quantity: 1,
      quantityBase: 1,
      unitCode: UnitCode.EA,
      storageLocation: StorageLocation.FRIDGE,
      expiryDate: "2026-04-19",
      expirySource: ExpirySource.MANUAL,
      status: ItemStatus.ACTIVE,
      createdAt: "2026-04-19",
      updatedAt: "2026-04-19",
    };
    const groups = groupInventoryItems([
      {
        ...baseItem,
        id: "1",
        displayName: "우유",
        productMasterId: "pm-milk",
      },
      {
        ...baseItem,
        id: "2",
        displayName: "서울우유 1L",
        productMasterId: "pm-milk",
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("uses canonical remaining quantities after partial consumption", () => {
    const groups = groupInventoryItems([
      {
        id: "milk-1",
        displayName: "우유 1L",
        quantity: 1,
        unit: "팩",
        quantityBase: 500,
        unitCode: UnitCode.ML,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: "2026-04-20",
        expirySource: ExpirySource.MANUAL,
        status: ItemStatus.ACTIVE,
        createdAt: "2026-04-19",
        updatedAt: "2026-04-19",
      },
    ]);

    expect(groups[0]?.totalQuantity).toBe(500);
    expect(groups[0]?.unit).toBe("ml");
  });
});
