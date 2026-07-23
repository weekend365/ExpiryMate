import {
  calculateDaysLeftUntilExpiry,
  getExpiryBucket,
  sortInventoryByNearestExpiry,
  StorageLocation,
  type InventoryItem,
} from "@expirymate/shared";

export type InventoryViewFilter = "all" | "today" | "within7" | "expired";

const inventoryViewFilters = new Set<InventoryViewFilter>([
  "all",
  "today",
  "within7",
  "expired",
]);

/** Parse a route/search param into a known inventory view filter. */
export const parseInventoryViewFilter = (
  value: string | string[] | undefined | null,
): InventoryViewFilter | null => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return null;
  }

  // Legacy deep link from home/recommendations.
  if (raw === "expiring") {
    return "within7";
  }

  if (!inventoryViewFilters.has(raw as InventoryViewFilter)) {
    return null;
  }

  return raw as InventoryViewFilter;
};

export const filterInventoryItems = (
  items: InventoryItem[],
  filter: InventoryViewFilter,
  location: StorageLocation | "all",
) => {
  const filtered = items.filter((item) => {
    if (location !== "all" && item.storageLocation !== location) {
      return false;
    }

    const bucket = getExpiryBucket(item.expiryDate);
    const daysLeft = calculateDaysLeftUntilExpiry(item.expiryDate);

    if (filter === "today") {
      return bucket === "today";
    }

    if (filter === "within7") {
      return daysLeft <= 7 && daysLeft >= 0;
    }

    if (filter === "expired") {
      return bucket === "expired";
    }

    return true;
  });

  return sortInventoryByNearestExpiry(filtered);
};
