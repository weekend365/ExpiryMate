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
  expiredCount: 0,
  within7DaysCount: 0,
  unknownExpiryCount: 0,
  hasInventory: true,
  hasLoaded: true,
};

describe("getHomeNotices", () => {
  it("leaves the first load to screen skeletons", () => {
    const notices = getHomeNotices({
      ...base,
      isInitialLoading: true,
      hasLoaded: false,
    });

    expect(notices).toEqual([]);
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

  it("shows only the background refresh error when loaded content is stale", () => {
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

    expect(notices.map((notice) => notice.id)).toEqual(["refresh-error"]);
    expect(notices[0]).toEqual(
      expect.objectContaining({ action: "retry" }),
    );
  });

  it("prioritizes expiring inventory ahead of a completed recommendation", () => {
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
      within7DaysCount: 1,
    });

    expect(notices.map((notice) => notice.id)).toEqual(["expiring"]);
  });

  it("shows a completed recommendation when no urgent inventory state exists", () => {
    const notices = getHomeNotices({
      ...base,
      recipeStatus: "success",
    });

    expect(notices).toEqual([
      expect.objectContaining({
        id: "recipe-success",
        action: "recommendations",
      }),
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
        action: "register",
        mood: "empty",
      }),
    ]);
  });

  it("prioritizes expired inventory over missing dates and recommendations", () => {
    expect(getHomeNotices({ ...base, expiredCount: 2, within7DaysCount: 3, unknownExpiryCount: 1, recipeStatus: "success" })[0])
      .toMatchObject({ id: "expired", action: "expired" });
  });

  it("uses the full urgent count even when the preview has no items", () => {
    expect(getHomeNotices({ ...base, within7DaysCount: 2, unknownExpiryCount: 1 })[0])
      .toMatchObject({ id: "expiring", action: "expiring", message: "7일 안에 기한이 오는 재료 2건을 먼저 살펴보세요." });
  });

  it("does not describe missing expiry dates as having no urgent work", () => {
    expect(getHomeNotices({ ...base, unknownExpiryCount: 3 })[0])
      .toMatchObject({ id: "unknown", action: "unknown" });
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
