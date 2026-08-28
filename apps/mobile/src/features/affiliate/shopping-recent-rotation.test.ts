import { describe, expect, it } from "vitest";
import {
  SHOPPING_RECENT_PAGE_SIZE,
  canLoadMoreRecentShopping,
  nextRecentShoppingVisibleCount,
  resolveRecentConsumedCount,
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

  it("keeps the first page of six", () => {
    expect(SHOPPING_RECENT_PAGE_SIZE).toBe(6);
    expect(takeRecentShoppingGroups(groups, SHOPPING_RECENT_PAGE_SIZE)).toEqual([
      "대파",
      "달걀",
      "우유",
      "두부",
      "양파",
      "당근",
    ]);
  });

  it("appends the remaining three items when loading more", () => {
    const first = takeRecentShoppingGroups(groups, 6);
    const nextVisible = nextRecentShoppingVisibleCount(6, groups.length);
    const second = takeRecentShoppingGroups(groups, nextVisible);
    expect(second).toEqual(groups);
    expect(second.slice(0, 6)).toEqual(first);
  });

  it("does not go past the remaining items", () => {
    const eightGroups = groups.slice(0, 8);
    expect(nextRecentShoppingVisibleCount(6, eightGroups.length)).toBe(8);
    expect(takeRecentShoppingGroups(eightGroups, 8)).toEqual(eightGroups);
  });

  it("hides load more when the first page already has everything", () => {
    expect(canLoadMoreRecentShopping(6, 6)).toBe(false);
    expect(canLoadMoreRecentShopping(6, 8)).toBe(true);
    expect(canLoadMoreRecentShopping(9, 9)).toBe(false);
  });

  it("prefers the 30-day unique count and falls back to loaded groups", () => {
    expect(resolveRecentConsumedCount(12, 3)).toBe(12);
    expect(resolveRecentConsumedCount(0, 3)).toBe(0);
    expect(resolveRecentConsumedCount(undefined, 4)).toBe(4);
  });
});
