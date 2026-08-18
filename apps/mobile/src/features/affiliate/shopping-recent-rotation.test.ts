import { describe, expect, it } from "vitest";
import {
  canLoadMoreRecentShopping,
  nextRecentShoppingVisibleCount,
  resolveRecentConsumedCount,
  takeRecentShoppingGroups,
} from "./shopping-recent-rotation";

describe("takeRecentShoppingGroups", () => {
  const groups = ["대파", "달걀", "우유", "두부", "양파", "당근"];

  it("keeps the first page of three", () => {
    expect(takeRecentShoppingGroups(groups, 3)).toEqual(["대파", "달걀", "우유"]);
  });

  it("appends the next three items when loading more", () => {
    const first = takeRecentShoppingGroups(groups, 3);
    const nextVisible = nextRecentShoppingVisibleCount(3, groups.length);
    const second = takeRecentShoppingGroups(groups, nextVisible);
    expect(second).toEqual(["대파", "달걀", "우유", "두부", "양파", "당근"]);
    expect(second.slice(0, 3)).toEqual(first);
  });

  it("does not go past the remaining items", () => {
    expect(nextRecentShoppingVisibleCount(3, 4)).toBe(4);
    expect(takeRecentShoppingGroups(["대파", "달걀", "우유", "두부"], 4)).toEqual([
      "대파",
      "달걀",
      "우유",
      "두부",
    ]);
  });

  it("hides load more when the first page already has everything", () => {
    expect(canLoadMoreRecentShopping(3, 3)).toBe(false);
    expect(canLoadMoreRecentShopping(3, 4)).toBe(true);
    expect(canLoadMoreRecentShopping(6, 6)).toBe(false);
  });

  it("prefers the 30-day unique count and falls back to loaded groups", () => {
    expect(resolveRecentConsumedCount(12, 3)).toBe(12);
    expect(resolveRecentConsumedCount(0, 3)).toBe(0);
    expect(resolveRecentConsumedCount(undefined, 4)).toBe(4);
  });
});
