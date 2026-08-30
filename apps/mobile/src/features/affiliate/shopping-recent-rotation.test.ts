import { describe, expect, it } from "vitest";
import {
  SHOPPING_RECENT_PAGE_SIZE,
  canLoadMoreRecentShopping,
  nextRecentShoppingVisibleCount,
  resolveRecentShoppingCount,
  takeRecentShoppingGroups,
} from "./shopping-recent-rotation";

describe("takeRecentShoppingGroups", () => {
  const groups = [
    "대파",
    "달걀",
    "우유",
    "두부",
    "양파",
    "당근",
    "감자",
    "버섯",
    "오이",
  ];

  it("keeps the first five when at least two groups remain", () => {
    expect(SHOPPING_RECENT_PAGE_SIZE).toBe(5);
    expect(takeRecentShoppingGroups(groups, SHOPPING_RECENT_PAGE_SIZE)).toEqual([
      "대파",
      "달걀",
      "우유",
      "두부",
      "양파",
    ]);
  });

  it("appends every remaining item when loading more", () => {
    const first = takeRecentShoppingGroups(groups, SHOPPING_RECENT_PAGE_SIZE);
    const nextVisible = nextRecentShoppingVisibleCount(groups.length);
    const second = takeRecentShoppingGroups(groups, nextVisible);
    expect(second).toEqual(groups);
    expect(second.slice(0, SHOPPING_RECENT_PAGE_SIZE)).toEqual(first);
  });

  it("keeps load more visible when one group remains", () => {
    const sixGroups = groups.slice(0, 6);
    const visible = takeRecentShoppingGroups(
      sixGroups,
      SHOPPING_RECENT_PAGE_SIZE,
    );
    expect(visible).toEqual(sixGroups.slice(0, 5));
    expect(canLoadMoreRecentShopping(visible.length, sixGroups.length)).toBe(
      true,
    );
    expect(nextRecentShoppingVisibleCount(sixGroups.length)).toBe(6);
  });

  it("loads two to four remaining groups for seven to nine candidates", () => {
    for (const total of [7, 8, 9]) {
      const candidates = groups.slice(0, total);
      const first = takeRecentShoppingGroups(
        candidates,
        SHOPPING_RECENT_PAGE_SIZE,
      );
      const nextVisible = nextRecentShoppingVisibleCount(candidates.length);
      expect(first).toHaveLength(5);
      expect(nextVisible - first.length).toBe(total - 5);
      expect(takeRecentShoppingGroups(candidates, nextVisible)).toEqual(
        candidates,
      );
    }
  });

  it("hides load more when every group is already visible", () => {
    expect(canLoadMoreRecentShopping(6, 6)).toBe(false);
    expect(canLoadMoreRecentShopping(5, 8)).toBe(true);
    expect(canLoadMoreRecentShopping(9, 9)).toBe(false);
  });

  it("prefers the 30-day unique count and falls back to loaded groups", () => {
    expect(resolveRecentShoppingCount(12, 3)).toBe(12);
    expect(resolveRecentShoppingCount(0, 3)).toBe(0);
    expect(resolveRecentShoppingCount(undefined, 4)).toBe(4);
  });
});
