import {
  calculateDaysLeftUntilExpiry,
  StorageLocation,
  type InventoryItem,
} from "@expirymate/shared";

export type RecommendationIngredientFilter =
  | "all"
  | "expiring"
  | "fridge"
  | "freezer";

export function filterRecommendationIngredientItems(
  items: InventoryItem[],
  options: {
    filter: RecommendationIngredientFilter;
    query: string;
    now?: Date | string;
  },
) {
  const normalizedQuery = options.query.trim().toLocaleLowerCase("ko-KR");

  return items.filter((item) => {
    if (
      normalizedQuery &&
      !item.displayName.toLocaleLowerCase("ko-KR").includes(normalizedQuery)
    ) {
      return false;
    }

    if (options.filter === "fridge") {
      return item.storageLocation === StorageLocation.FRIDGE;
    }
    if (options.filter === "freezer") {
      return item.storageLocation === StorageLocation.FREEZER;
    }
    if (options.filter === "expiring") {
      return isExpiringRecommendationIngredient(item, options.now);
    }
    return true;
  });
}

export function getExpiringRecommendationIngredientIds(
  items: InventoryItem[],
  now?: Date | string,
) {
  return items
    .filter((item) => isExpiringRecommendationIngredient(item, now))
    .map((item) => item.id);
}

function isExpiringRecommendationIngredient(
  item: InventoryItem,
  now?: Date | string,
) {
  if (!item.expiryDate) return false;
  const daysLeft = calculateDaysLeftUntilExpiry(item.expiryDate, now);
  return daysLeft >= 0 && daysLeft <= 7;
}
