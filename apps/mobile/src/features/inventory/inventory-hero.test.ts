import { describe, expect, it } from "vitest";
import { getInventoryHeroNotice, getInventoryHeroNotices } from "./inventory-hero";

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
  it("keeps the hero visible while selecting items to clean up", () => {
    expect(
      getInventoryHeroNotice({ ...populated, isSelectionMode: true }),
    ).toEqual({
      show: true,
      mood: "speak",
      tone: "neutral",
      message: "정리할 재료를 골라 주세요.",
    });
  });

  it("keeps Jango visible while the first load is in progress", () => {
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
      message: "보관함을 살펴보고 있어요. 조금만 기다려 주세요.",
    });
  });

  it("keeps Jango visible for an initial error", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        isInitialError: true,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toEqual({
      show: true,
      mood: "worry",
      tone: "danger",
      message: "앗, 보관함을 불러오지 못했어요. 다시 살펴볼까요?",
    });
  });

  it("keeps Jango visible for an empty inventory", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toEqual({
      show: true,
      mood: "empty",
      tone: "neutral",
      message: "아직 넣어둔 재료가 없어요. 첫 재료를 넣어 볼까요?",
    });
  });

  it("explains an empty filtered result in the persistent hero", () => {
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
      message: "지금 고른 조건에 맞는 재료가 없어요.",
    });
  });

  it("summarizes the active filtered view", () => {
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
      mood: "speak",
      tone: "neutral",
      message: "조건에 맞는 재료 2개를 모아 뒀어요.",
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
      tone: "neutral",
      message: "조건에 맞는 재료 3개를 모아 뒀어요.",
    });

    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 5,
        statusFilter: "safe",
      }),
    ).toEqual({
      show: true,
      mood: "speak",
      tone: "neutral",
      message: "조건에 맞는 재료 5개를 모아 뒀어요.",
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
      message: "기한이 지난 재료 1개부터 정리할까요?",
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
      message: "7일 안에 손볼 재료 3개를 확인할까요?",
    });
  });

  it("keeps a calm success message visible", () => {
    expect(getInventoryHeroNotice(populated)).toEqual({
      show: true,
      mood: "happy",
      tone: "success",
      message: "재료 4개가 잘 정리되어 있어요.",
    });
  });
});

describe("getInventoryHeroNotices", () => {
  it("still supports an explicitly disabled hero", () => {
    expect(
      getInventoryHeroNotices({
        hero: { show: false },
      }),
    ).toEqual([]);
  });

  it("keeps the regular hero limited to the current fridge status", () => {
    expect(
      getInventoryHeroNotices({
        hero: {
          show: true,
          mood: "speak",
          tone: "warning",
          message: "일주일 안에 손볼 재료가 6개 있어요.",
        },
      }),
    ).toEqual([
      {
        id: "status",
        mood: "speak",
        message: "일주일 안에 손볼 재료가 6개 있어요.",
      },
    ]);
  });
});
