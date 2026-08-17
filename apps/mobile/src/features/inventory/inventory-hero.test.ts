import { describe, expect, it } from "vitest";
import { getInventoryHeroNotice } from "./inventory-hero";

const populated = {
  isInitialLoading: false,
  isInitialError: false,
  isSelectionMode: false,
  totalCount: 4,
  visibleCount: 4,
  expiredCount: 0,
  within7Count: 0,
  statusFilter: "all" as const,
};

describe("getInventoryHeroNotice", () => {
  it("hides the hero while selecting items to clean up", () => {
    expect(
      getInventoryHeroNotice({ ...populated, isSelectionMode: true }),
    ).toEqual({ show: false });
  });

  it("shows a thinking hero while the first load is in flight", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        isInitialLoading: true,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toEqual({
      show: true,
      mood: "think",
      tone: "neutral",
      message: "보관함을 살펴보고 있어요.",
    });
  });

  it("lets the empty-error state own 장고", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        isInitialError: true,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toEqual({ show: false });
  });

  it("lets the empty-inventory state own 장고", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toEqual({ show: false });
  });

  it("asks to clear filters when the current view is empty", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 0,
        statusFilter: "expired",
        expiredCount: 0,
      }),
    ).toEqual({
      show: true,
      mood: "idle",
      tone: "neutral",
      message: "이 조건에는 재료가 없어요. 조건을 풀어 볼까요?",
    });
  });

  it("describes the active expiry filter instead of the whole fridge", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 2,
        expiredCount: 2,
        within7Count: 1,
        statusFilter: "expired",
      }),
    ).toEqual({
      show: true,
      mood: "worry",
      tone: "danger",
      message: "만료된 재료 2개를 보고 있어요.",
    });

    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 3,
        statusFilter: "within7",
      }),
    ).toEqual({
      show: true,
      mood: "speak",
      tone: "warning",
      message: "일주일 안에 손볼 재료 3개를 보고 있어요.",
    });

    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 5,
        statusFilter: "safe",
      }),
    ).toEqual({
      show: true,
      mood: "happy",
      tone: "success",
      message: "여유 있는 재료 5개를 보고 있어요.",
    });
  });

  it("warns about expired items first in the unfiltered view", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        expiredCount: 1,
        within7Count: 3,
      }),
    ).toEqual({
      show: true,
      mood: "worry",
      tone: "danger",
      message:
        "기한이 지난 재료가 1개 있어요. 위에서부터 손보면 좋아요.",
    });
  });

  it("mentions soon-to-expire items when nothing is expired", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        within7Count: 3,
      }),
    ).toEqual({
      show: true,
      mood: "speak",
      tone: "warning",
      message: "일주일 안에 손볼 재료가 3개 있어요.",
    });
  });

  it("stays calm when every visible item still has time", () => {
    expect(getInventoryHeroNotice(populated)).toEqual({
      show: true,
      mood: "happy",
      tone: "success",
      message: "지금은 급한 재료가 없어요.",
    });
  });
});
