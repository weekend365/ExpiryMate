import { describe, expect, it } from "vitest";
import {
  ExpirySource,
  ItemStatus,
  StorageLocation,
  UnitCode,
} from "../enums/app-enums";
import { addDays, toIsoDate } from "./date";
import {
  generateDashboardSummary,
  getExpiryBucket,
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
  });

  it("builds dashboard summary counts", () => {
    const now = new Date("2026-04-19T09:00:00.000Z");
    const items = [
      {
        id: "1",
        displayName: "서울우유 1L",
        quantity: 1,
        quantityBase: 1000,
        unitCode: UnitCode.ML,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: toIsoDate(now),
        expirySource: ExpirySource.MANUAL,
        status: ItemStatus.ACTIVE,
        createdAt: toIsoDate(now),
        updatedAt: toIsoDate(now),
      },
      {
        id: "2",
        displayName: "계란 10구",
        quantity: 1,
        quantityBase: 10,
        unitCode: UnitCode.EA,
        storageLocation: StorageLocation.FRIDGE,
        expiryDate: toIsoDate(addDays(now, 3)),
        expirySource: ExpirySource.PRESET,
        status: ItemStatus.ACTIVE,
        createdAt: toIsoDate(now),
        updatedAt: toIsoDate(now),
      },
      {
        id: "3",
        displayName: "냉동 만두",
        quantity: 1,
        quantityBase: 1,
        unitCode: UnitCode.EA,
        storageLocation: StorageLocation.FREEZER,
        expiryDate: toIsoDate(addDays(now, -2)),
        expirySource: ExpirySource.MANUAL,
        status: ItemStatus.EXPIRED,
        createdAt: toIsoDate(now),
        updatedAt: toIsoDate(now),
      },
    ];

    const summary = generateDashboardSummary(items, now);

    expect(summary.todayExpiryCount).toBe(1);
    expect(summary.within3DaysCount).toBe(2);
    expect(summary.within7DaysCount).toBe(2);
    expect(summary.expiredCount).toBe(1);
    expect(summary.totalActiveCount).toBe(3);
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
