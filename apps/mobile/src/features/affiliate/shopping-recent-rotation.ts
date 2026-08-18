export const SHOPPING_RECENT_PAGE_SIZE = 3;

export function pickRecentShoppingGroups<T>(
  groups: T[],
  offset: number,
  pageSize = SHOPPING_RECENT_PAGE_SIZE,
): T[] {
  if (groups.length <= pageSize) return groups;
  const start = ((offset % groups.length) + groups.length) % groups.length;
  return Array.from(
    { length: pageSize },
    (_, index) => groups[(start + index) % groups.length]!,
  );
}

export function advanceRecentShoppingOffset(
  offset: number,
  total: number,
  pageSize = SHOPPING_RECENT_PAGE_SIZE,
) {
  if (total <= pageSize) return 0;
  return (offset + pageSize) % total;
}

export function canRotateRecentShoppingGroups(
  total: number,
  pageSize = SHOPPING_RECENT_PAGE_SIZE,
) {
  return total > pageSize;
}

export function recentShoppingRotationNotice(total: number) {
  if (total <= 0) {
    return "아직 바꿔 줄 최근 재료가 없어요.";
  }
  return "지금은 이 재료들이 전부예요. 다 쓴 재료가 더 생기면 바꿔 볼게요.";
}
