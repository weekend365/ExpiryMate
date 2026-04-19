import { ItemStatus, StorageLocation } from "../enums/app-enums";
import type { DashboardSummary, InventoryItem } from "../types/models";
import { calculateDaysLeftUntilExpiry } from "./date";

export type ExpiryBucket =
  | "expired"
  | "today"
  | "within_3_days"
  | "within_7_days"
  | "safe";

export const isTrackedItem = (item: InventoryItem) =>
  item.status === ItemStatus.ACTIVE || item.status === ItemStatus.EXPIRED;

export const getExpiryBucket = (
  expiryDate: string,
  now: Date | string = new Date(),
): ExpiryBucket => {
  const daysLeft = calculateDaysLeftUntilExpiry(expiryDate, now);

  if (daysLeft < 0) {
    return "expired";
  }

  if (daysLeft === 0) {
    return "today";
  }

  if (daysLeft <= 3) {
    return "within_3_days";
  }

  if (daysLeft <= 7) {
    return "within_7_days";
  }

  return "safe";
};

export const sortInventoryByNearestExpiry = (
  items: InventoryItem[],
  now: Date | string = new Date(),
) => {
  return [...items].sort((left, right) => {
    const leftDays = calculateDaysLeftUntilExpiry(left.expiryDate, now);
    const rightDays = calculateDaysLeftUntilExpiry(right.expiryDate, now);

    if (leftDays !== rightDays) {
      return leftDays - rightDays;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};

export const filterExpiringItems = (
  items: InventoryItem[],
  maxDays: number,
  now: Date | string = new Date(),
) => {
  return items.filter((item) => {
    if (!isTrackedItem(item)) {
      return false;
    }

    const daysLeft = calculateDaysLeftUntilExpiry(item.expiryDate, now);
    return daysLeft <= maxDays;
  });
};

export const buildLocationCounts = (items: InventoryItem[]) => {
  const counts = Object.values(StorageLocation).reduce<Record<string, number>>(
    (result, location) => {
      result[location] = 0;
      return result;
    },
    {},
  );

  items.forEach((item) => {
    counts[item.storageLocation] = (counts[item.storageLocation] ?? 0) + 1;
  });

  return counts;
};

export const generateDashboardSummary = (
  items: InventoryItem[],
  now: Date | string = new Date(),
): DashboardSummary => {
  const trackedItems = items.filter(isTrackedItem);
  const sortedItems = sortInventoryByNearestExpiry(trackedItems, now);

  return {
    todayExpiryCount: trackedItems.filter(
      (item) => getExpiryBucket(item.expiryDate, now) === "today",
    ).length,
    within3DaysCount: trackedItems.filter((item) => {
      const bucket = getExpiryBucket(item.expiryDate, now);
      return bucket === "today" || bucket === "within_3_days";
    }).length,
    within7DaysCount: trackedItems.filter((item) => {
      const bucket = getExpiryBucket(item.expiryDate, now);
      return (
        bucket === "today" ||
        bucket === "within_3_days" ||
        bucket === "within_7_days"
      );
    }).length,
    expiredCount: trackedItems.filter(
      (item) => getExpiryBucket(item.expiryDate, now) === "expired",
    ).length,
    totalActiveCount: trackedItems.length,
    recentItems: [...items]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .slice(0, 5),
    expiringItems: sortedItems.slice(0, 5),
    locationCounts: buildLocationCounts(trackedItems),
  };
};
