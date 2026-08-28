export const SHOPPING_RECENT_PAGE_SIZE = 6;

export function takeRecentShoppingGroups<T>(
  groups: T[],
  visibleCount: number,
): T[] {
  return groups.slice(0, Math.max(visibleCount, 0));
}

export function nextRecentShoppingVisibleCount(
  visibleCount: number,
  total: number,
  pageSize = SHOPPING_RECENT_PAGE_SIZE,
) {
  return Math.min(Math.max(visibleCount, 0) + pageSize, Math.max(total, 0));
}

export function canLoadMoreRecentShopping(
  visibleCount: number,
  total: number,
) {
  return visibleCount < total;
}

export function resolveRecentConsumedCount(
  recentConsumedCount: number | undefined,
  groupCount: number,
) {
  if (
    typeof recentConsumedCount === "number" &&
    Number.isFinite(recentConsumedCount)
  ) {
    return Math.max(Math.trunc(recentConsumedCount), 0);
  }
  return Math.max(groupCount, 0);
}
