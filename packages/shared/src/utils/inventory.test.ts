import { describe, expect, it } from "vitest";
import { ExpirySource, ItemStatus, StorageLocation } from "../enums/app-enums";
import { addDays, toIsoDate } from "./date";
import { generateDashboardSummary, getExpiryBucket } from "./inventory";

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
});
