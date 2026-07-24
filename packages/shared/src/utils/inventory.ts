import { unitCodeLabels } from "../constants/labels";
import { ItemStatus, StorageLocation, UnitCode } from "../enums/app-enums";
import type { DashboardSummary, InventoryItem } from "../types/models";
import { calculateDaysLeftUntilExpiry } from "./date";

export interface InventoryItemGroup {
  id: string;
  displayName: string;
  brand?: string | null;
  items: InventoryItem[];
  nearestExpiryDate: string;
  totalQuantity: number;
  unit?: string | null;
  hasMixedUnits: boolean;
}

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

const normalizeIdentityPart = (value?: string | null) =>
  value?.normalize("NFKC").trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR") ??
  "";

/**
 * Groups expiry lots that belong to the same product while preserving each lot.
 * A stable product id wins; manually-entered items fall back to name + brand.
 */
export const groupInventoryItems = (
  items: InventoryItem[],
  now: Date | string = new Date(),
): InventoryItemGroup[] => {
  const sortedItems = sortInventoryByNearestExpiry(items, now);
  const groups = new Map<string, InventoryItem[]>();

  sortedItems.forEach((item) => {
    const fallbackIdentity = [
      normalizeIdentityPart(item.displayName),
      normalizeIdentityPart(item.brand),
    ].join(":");
    const groupId = item.productId
      ? `product:${item.productId}`
      : `manual:${fallbackIdentity}`;
    const currentItems = groups.get(groupId);

    if (currentItems) {
      currentItems.push(item);
    } else {
      groups.set(groupId, [item]);
    }
  });

  return Array.from(groups, ([id, groupItems]) => {
    const representative = groupItems[0]!;
    const usesCanonicalQuantity = groupItems.some(
      (item) =>
        item.unitCode !== UnitCode.EA ||
        item.quantityBase !== item.quantity,
    );
    const normalizedUnits = new Set(
      groupItems.map((item) =>
        usesCanonicalQuantity
          ? item.unitCode
          : normalizeIdentityPart(item.unit ?? "개"),
      ),
    );

    return {
      id,
      displayName: representative.displayName,
      brand: representative.brand,
      items: groupItems,
      nearestExpiryDate: representative.expiryDate,
      totalQuantity: groupItems.reduce(
        (total, item) =>
          total +
          (usesCanonicalQuantity ? item.quantityBase : item.quantity),
        0,
      ),
      unit: usesCanonicalQuantity
        ? unitCodeLabels[representative.unitCode]
        : (representative.unit ?? "개"),
      hasMixedUnits: normalizedUnits.size > 1,
    };
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

export const buildLocationCounts = (
  items: InventoryItem[],
  customKeys: string[] = [],
) => {
  const keys = [
    ...Object.values(StorageLocation),
    ...customKeys.filter((key) => !Object.values(StorageLocation).includes(key as StorageLocation)),
  ];
  const counts = keys.reduce<Record<string, number>>((result, location) => {
    result[location] = 0;
    return result;
  }, {});

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
  const expiringGroups = groupInventoryItems(sortedItems, now).slice(0, 5);

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
    expiringItems: expiringGroups.flatMap((group) => group.items),
    locationCounts: buildLocationCounts(trackedItems),
  };
};
