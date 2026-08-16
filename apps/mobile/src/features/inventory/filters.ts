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
  expired: "만료",
  within7: "곧 만료",
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

const getItemViewFilter = (
  item: InventoryItem,
): Exclude<InventoryViewFilter, "all"> => {
  const bucket = getExpiryTrafficBucket(item.expiryDate);

  return bucket === "within_7_days" ? "within7" : bucket;
};

export interface InventoryFacetCounts {
  status: Record<InventoryViewFilter, number>;
  location: Record<string, number>;
  locationTotal: number;
}

/**
 * Counts each facet against the other active facets:
 * status excludes the active status, while location excludes the active location.
 */
export const buildInventoryFacetCounts = (
  items: InventoryItem[],
  activeFilter: InventoryViewFilter,
  activeLocation: string | "all",
  searchQuery = "",
): InventoryFacetCounts => {
  const counts: InventoryFacetCounts = {
    status: {
      all: 0,
      expired: 0,
      within7: 0,
      safe: 0,
    },
    location: {},
    locationTotal: 0,
  };

  items.forEach((item) => {
    if (!matchesSearchQuery(item, searchQuery)) {
      return;
    }

    const itemFilter = getItemViewFilter(item);

    if (
      activeLocation === "all" ||
      item.storageLocation === activeLocation
    ) {
      counts.status.all += 1;
      counts.status[itemFilter] += 1;
    }

    if (activeFilter === "all" || itemFilter === activeFilter) {
      counts.location[item.storageLocation] =
        (counts.location[item.storageLocation] ?? 0) + 1;
      counts.locationTotal += 1;
    }
  });

  return counts;
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

    return filter === "all" || getItemViewFilter(item) === filter;
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
