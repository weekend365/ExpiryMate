import {
  getExpiryTrafficBucket,
  groupInventoryItems,
  sortInventoryByNearestExpiry,
  type InventoryItem,
} from "@expirymate/shared";

export type InventoryViewFilter = "all" | "expired" | "within7" | "safe";

export type InventoryUrgencySection = "expired" | "within7" | "safe";

export const inventoryUrgencySectionOrder: InventoryUrgencySection[] = [
  "expired",
  "within7",
  "safe",
];

export const inventoryUrgencySectionTitles: Record<
  InventoryUrgencySection,
  string
> = {
  expired: "만료됨",
  within7: "7일 이내",
  safe: "여유 있어요",
};

const inventoryViewFilters = new Set<InventoryViewFilter>([
  "all",
  "within7",
  "safe",
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

  // Legacy deep links: today's items now belong to the inclusive seven-day bucket.
  if (raw === "today" || raw === "expiring") {
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

    const bucket = getExpiryTrafficBucket(item.expiryDate);

    if (filter === "expired") {
      return bucket === "expired";
    }

    if (filter === "within7") {
      return bucket === "within_7_days";
    }

    if (filter === "safe") {
      return bucket === "safe";
    }

    return true;
  });

  return sortInventoryByNearestExpiry(filtered);
};

/** Map a group's nearest expiry into a list section bucket. */
export const getInventoryUrgencySection = (
  nearestExpiryDate: string,
): InventoryUrgencySection => {
  const bucket = getExpiryTrafficBucket(nearestExpiryDate);

  if (bucket === "within_7_days") {
    return "within7";
  }

  return bucket;
};

export const buildInventoryUrgencySections = (
  items: InventoryItem[],
) => {
  const buckets: Record<InventoryUrgencySection, InventoryItem[]> = {
    expired: [],
    within7: [],
    safe: [],
  };

  items.forEach((item) => {
    buckets[getInventoryUrgencySection(item.expiryDate)].push(item);
  });

  return inventoryUrgencySectionOrder
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      title: inventoryUrgencySectionTitles[key],
      itemCount: buckets[key].length,
      data: groupInventoryItems(buckets[key]).map((group) => ({
        ...group,
        id: `${key}:${group.id}`,
      })),
    }));
};
