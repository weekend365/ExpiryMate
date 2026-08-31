import type { InventoryViewFilter } from "./filters";

export function getFilteredEmptyMood(filter: InventoryViewFilter) {
  if (filter === "within7" || filter === "safe") {
    return "happy" as const;
  }

  return "idle" as const;
}

export function getFilteredEmptyTitle(
  filter: InventoryViewFilter,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return "찾는 재료가 없어요";
  }

  if (filter === "within7") {
    return "7일 안에 손볼 재료가 없어요";
  }

  if (filter === "expired") {
    return "기한 지난 재료가 없어요";
  }

  if (filter === "safe") {
    return "여유 있는 재료가 없어요";
  }

  if (filter === "unknown") {
    return "기한을 확인할 재료가 없어요";
  }

  return "이 위치에는 재료가 없어요";
}

export function getFilteredEmptyDescription(
  filter: InventoryViewFilter,
  hasLocationFilter: boolean,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return hasLocationFilter || filter !== "all"
      ? "검색어를 지우거나 필터를 넓혀 볼까요?"
      : "다른 이름으로 찾아볼까요?";
  }

  if (filter === "within7") {
    return hasLocationFilter
      ? "위치를 바꾸거나 필터를 풀고 전체를 볼까요?"
      : "급한 재료가 없어요. 필터를 풀고 전체 목록을 볼까요?";
  }

  if (filter === "expired" || filter === "safe" || filter === "unknown") {
    return hasLocationFilter
      ? "위치를 바꾸거나 필터를 풀고 전체를 볼까요?"
      : "이 조건에는 재료가 없어요. 필터를 풀고 전체를 볼까요?";
  }

  if (hasLocationFilter) {
    return "다른 위치를 고르거나, 필터를 풀고 전체를 볼까요?";
  }

  return "조건을 조금 넓히거나, 필터를 풀고 전체를 볼까요?";
}
