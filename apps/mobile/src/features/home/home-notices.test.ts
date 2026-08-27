import { describe, expect, it } from "vitest";
import { getHeroTone, getHomeNotices } from "./home-notices";

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

  it("offers an explicit retry when the first load fails", () => {
    const notices = getHomeNotices({
      ...base,
      isInitialError: true,
      hasLoaded: false,
    });

    expect(notices).toEqual([
      expect.objectContaining({
        id: "initial-error",
        action: "retry",
      }),
    ]);
  });

  it("keeps loaded content notices alongside a background refresh error", () => {
    const notices = getHomeNotices({
      ...base,
      isRefreshError: true,
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
      "refresh-error",
      "expiring",
    ]);
    expect(notices[0]).toEqual(
      expect.objectContaining({ action: "retry" }),
    );
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

describe("getHeroTone", () => {
  it("uses warning for an expiring notice even when the mood is speak", () => {
    expect(
      getHeroTone({
        id: "expiring",
        message: "우유, 먼저 살펴볼까요?",
        mood: "speak",
        action: "expiring",
      }),
    ).toBe("warning");
  });

  it("uses danger for a worry notice that is not an expiring action", () => {
    expect(
      getHeroTone({
        id: "initial-error",
        message: "앗, 오늘 할 일을 불러오지 못했어요.",
        mood: "worry",
        action: "retry",
      }),
    ).toBe("danger");
  });

  it("falls back to primary when there is no notice", () => {
    expect(getHeroTone(null)).toBe("primary");
  });
});
