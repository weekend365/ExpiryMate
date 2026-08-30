export const SHOPPING_RECENT_PAGE_SIZE = 5;

export function takeRecentShoppingGroups<T>(
  groups: T[],
  visibleCount: number,
): T[] {
  return groups.slice(0, Math.max(visibleCount, 0));
}

export function nextRecentShoppingVisibleCount(
  total: number,
) {
  return Math.max(total, 0);
}

export function canLoadMoreRecentShopping(
  visibleCount: number,
  total: number,
) {
  return visibleCount < total;
}

export function resolveRecentShoppingCount(
  recentResolvedCount: number | undefined,
  groupCount: number,
) {
  if (
    typeof recentResolvedCount === "number" &&
    Number.isFinite(recentResolvedCount)
  ) {
    return Math.max(Math.trunc(recentResolvedCount), 0);
  }
  return Math.max(groupCount, 0);
}
