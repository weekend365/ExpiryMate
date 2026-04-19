import {
  calculateDaysLeftUntilExpiry,
  getExpiryBucket,
  sortInventoryByNearestExpiry,
  StorageLocation,
  type InventoryItem,
} from "@expirymate/shared";

export type InventoryViewFilter = "all" | "expiring" | "expired";

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
