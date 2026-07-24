import { describe, expect, it } from "vitest";
import { getHomeNotices } from "./home-notices";

const base = {
  isInitialLoading: false,
  isInitialError: false,
  isRefreshError: false,
  loadErrorMessage: "load failed",
  recipeStatus: "idle" as const,
  recipeErrorMessage: null,
  expiringGroups: [] as [],
  hasInventory: true,
  hasLoaded: true,
};

describe("getHomeNotices", () => {
  it("returns only loading notice while first load is in flight", () => {
    const notices = getHomeNotices({
      ...base,
      isInitialLoading: true,
      hasLoaded: false,
    });

    expect(notices).toEqual([
      expect.objectContaining({ id: "loading", mood: "think" }),
    ]);
  });

  it("prioritizes recipe success ahead of expiring items", () => {
    const notices = getHomeNotices({
      ...base,
      recipeStatus: "success",
      expiringGroups: [
        {
          id: "g1",
          displayName: "우유",
          brand: null,
          items: [],
          nearestExpiryDate: "2026-07-24",
          totalQuantity: 1,
          unit: "개",
          hasMixedUnits: false,
        },
      ],
    });

    expect(notices.map((notice) => notice.id)).toEqual([
      "recipe-success",
      "expiring",
    ]);
  });

  it("builds an empty-fridge notice when there is no inventory", () => {
    const notices = getHomeNotices({
      ...base,
      hasInventory: false,
    });

    expect(notices).toEqual([
      expect.objectContaining({
        id: "empty",
        action: "scanner",
        mood: "empty",
      }),
    ]);
  });
});
