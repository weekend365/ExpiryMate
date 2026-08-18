import { describe, expect, it } from "vitest";
import {
  advanceRecentShoppingOffset,
  canRotateRecentShoppingGroups,
  pickRecentShoppingGroups,
  recentShoppingRotationNotice,
} from "./shopping-recent-rotation";

describe("pickRecentShoppingGroups", () => {
  const groups = ["대파", "달걀", "우유", "두부", "양파", "당근"];

  it("keeps the first page of three", () => {
    expect(pickRecentShoppingGroups(groups, 0)).toEqual(["대파", "달걀", "우유"]);
  });

  it("shows three different items on refresh when enough remain", () => {
    const first = pickRecentShoppingGroups(groups, 0);
    const nextOffset = advanceRecentShoppingOffset(0, groups.length);
    const second = pickRecentShoppingGroups(groups, nextOffset);
    expect(second).toEqual(["두부", "양파", "당근"]);
    expect(second.some((item) => first.includes(item))).toBe(false);
  });

  it("always returns three items when the pool has at least three", () => {
    let offset = 0;
    const pool = ["대파", "달걀", "우유", "두부"];
    for (let step = 0; step < 6; step += 1) {
      const page = pickRecentShoppingGroups(pool, offset);
      expect(page).toHaveLength(3);
      offset = advanceRecentShoppingOffset(offset, pool.length);
    }
  });

  it("does not empty the list when only three items exist", () => {
    const pool = ["대파", "달걀", "우유"];
    const nextOffset = advanceRecentShoppingOffset(0, pool.length);
    expect(pickRecentShoppingGroups(pool, nextOffset)).toEqual(pool);
  });

  it("explains when there is nothing else to show", () => {
    expect(canRotateRecentShoppingGroups(3)).toBe(false);
    expect(canRotateRecentShoppingGroups(4)).toBe(true);
    expect(recentShoppingRotationNotice(3)).toContain("전부예요");
    expect(recentShoppingRotationNotice(0)).toContain("없어요");
  });
});
