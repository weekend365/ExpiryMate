import {
  calculateDaysLeftUntilExpiry,
  getExpiryBucket,
  sortInventoryByNearestExpiry,
  StorageLocation,
  type InventoryItem,
} from "@expirymate/shared";

export type InventoryViewFilter = "all" | "expiring" | "expired";

const inventoryViewFilters = new Set<InventoryViewFilter>([
  "all",
  "expiring",
  "expired",
]);

/** Parse a route/search param into a known inventory view filter. */
export const parseInventoryViewFilter = (
  value: string | string[] | undefined | null,
): InventoryViewFilter | null => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw || !inventoryViewFilters.has(raw as InventoryViewFilter)) {
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

    if (filter === "expiring") {
      const daysLeft = calculateDaysLeftUntilExpiry(item.expiryDate);
      return daysLeft <= 7 && daysLeft >= 0;
    }

    if (filter === "expired") {
      return bucket === "expired";
    }

    return true;
  });

  return sortInventoryByNearestExpiry(filtered);
};
