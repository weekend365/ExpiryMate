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
  it("hides the hero while selecting items to clean up", () => {
    expect(
      getInventoryHeroNotice({ ...populated, isSelectionMode: true }),
    ).toEqual({ show: false });
  });

  it("lets the list skeleton own the first loading state", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        isInitialLoading: true,
        totalCount: 0,
        visibleCount: 0,
      }),
    ).toEqual({ show: false });
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

  it("lets the filtered empty state explain an empty result", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 0,
        statusFilter: "expired",
        expiredCount: 0,
      }),
    ).toEqual({ show: false });
  });

  it("stays hidden when a status chip already explains the active view", () => {
    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 2,
        expiredCount: 2,
        within7Count: 1,
        statusFilter: "expired",
      }),
    ).toEqual({ show: false });

    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 3,
        statusFilter: "within7",
      }),
    ).toEqual({ show: false });

    expect(
      getInventoryHeroNotice({
        ...populated,
        visibleCount: 5,
        statusFilter: "safe",
      }),
    ).toEqual({ show: false });
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
      supportingMessage: "눌러서 만료된 재료만 모아 볼 수 있어요.",
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
      supportingMessage: "눌러서 곧 만료되는 재료만 모아 볼 수 있어요.",
    });
  });

  it("does not spend vertical space on a no-action success message", () => {
    expect(getInventoryHeroNotice(populated)).toEqual({ show: false });
  });
});

describe("getInventoryHeroNotices", () => {
  it("hides the carousel when the status hero is off", () => {
    expect(
      getInventoryHeroNotices({
        hero: { show: false },
        successMessage: "4개 재료를 정리했어요. 장고도 한숨 돌렸어요.",
      }),
    ).toEqual([]);
  });

  it("puts a cleanup success line in front of the fridge status", () => {
    expect(
      getInventoryHeroNotices({
        hero: {
          show: true,
          mood: "speak",
          tone: "warning",
          message: "일주일 안에 손볼 재료가 6개 있어요.",
        },
        successMessage: "4개 재료를 정리했어요. 장고도 한숨 돌렸어요.",
      }).map((notice) => notice.id),
    ).toEqual(["success", "status"]);
  });
});
