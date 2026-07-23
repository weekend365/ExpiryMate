import {
  calculateDaysLeftUntilExpiry,
  getExpiryBucket,
  sortInventoryByNearestExpiry,
  type InventoryItem,
  type InventoryItemGroup,
} from "@expirymate/shared";

export type InventoryViewFilter = "all" | "today" | "within7" | "expired";

export type InventoryUrgencySection = "today" | "within7" | "safe";

export const inventoryUrgencySectionOrder: InventoryUrgencySection[] = [
  "today",
  "within7",
  "safe",
];

export const inventoryUrgencySectionTitles: Record<
  InventoryUrgencySection,
  string
> = {
  today: "오늘 만료",
  within7: "7일 이내",
  safe: "여유 있어요",
};

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

const matchesSearchQuery = (item: InventoryItem, searchQuery: string) => {
  const needle = searchQuery.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  const haystacks = [item.displayName, item.brand].filter(
    (value): value is string => Boolean(value),
  );

  return haystacks.some((value) => value.toLowerCase().includes(needle));
};

export const filterInventoryItems = (
  items: InventoryItem[],
  filter: InventoryViewFilter,
  location: string | "all",
  searchQuery = "",
) => {
  const filtered = items.filter((item) => {
    if (!matchesSearchQuery(item, searchQuery)) {
      return false;
    }

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

/** Map a group's nearest expiry into a list section bucket. */
export const getInventoryUrgencySection = (
  nearestExpiryDate: string,
): InventoryUrgencySection => {
  const daysLeft = calculateDaysLeftUntilExpiry(nearestExpiryDate);

  if (daysLeft <= 0) {
    return "today";
  }

  if (daysLeft <= 7) {
    return "within7";
  }

  return "safe";
};

export const buildInventoryUrgencySections = (
  groups: InventoryItemGroup[],
) => {
  const buckets: Record<InventoryUrgencySection, InventoryItemGroup[]> = {
    today: [],
    within7: [],
    safe: [],
  };

  groups.forEach((group) => {
    buckets[getInventoryUrgencySection(group.nearestExpiryDate)].push(group);
  });

  return inventoryUrgencySectionOrder
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      title: inventoryUrgencySectionTitles[key],
      data: buckets[key],
    }));
};
