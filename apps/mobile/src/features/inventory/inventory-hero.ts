import type { JangoHeroNoticeItem } from "../../components/JangoHeroNoticeCarousel";
import type { MascotMood } from "../../components/Mascot";
import type { InventoryViewFilter } from "./filters";

export type InventoryHeroTone = "danger" | "warning" | "success" | "neutral";
export type InventoryHeroAction =
  | "retry"
  | "add_ingredient"
  | "clear_filters"
  | "show_expired"
  | "show_within7";

export type InventoryHeroNotice =
  | { show: false }
  | {
      show: true;
      mood: MascotMood;
      tone: InventoryHeroTone;
      message: string;
      action?: InventoryHeroAction;
      actionLabel?: string;
    };

export function getInventoryHeroNotice(input: {
  isInitialLoading: boolean;
  isInitialError: boolean;
  isSelectionMode: boolean;
  totalCount: number;
  visibleCount: number;
  expiredCount: number;
  within7Count: number;
  statusFilter: InventoryViewFilter;
}): InventoryHeroNotice {
  if (input.isSelectionMode) {
    return {
      show: true,
      mood: "speak",
      tone: "neutral",
      message: "정리할 재료를 골라 주세요.",
    };
  }

  if (input.isInitialLoading) {
    return { show: false };
  }

  if (input.isInitialError) {
    return {
      show: true,
      mood: "worry",
      tone: "danger",
      message: "앗, 보관함을 불러오지 못했어요. 다시 살펴볼까요?",
      action: "retry",
      actionLabel: "다시 시도",
    };
  }

  if (input.totalCount === 0) {
    return {
      show: true,
      mood: "empty",
      tone: "neutral",
      message: "아직 넣어둔 재료가 없어요. 첫 재료를 넣어 볼까요?",
      action: "add_ingredient",
      actionLabel: "재료 넣기",
    };
  }

  if (input.visibleCount === 0) {
    return {
      show: true,
      mood: "idle",
      tone: "neutral",
      message: "지금 고른 조건에 맞는 재료가 없어요.",
      action: "clear_filters",
      actionLabel: "필터 해제",
    };
  }

  if (input.statusFilter !== "all" || input.visibleCount < input.totalCount) {
    return {
      show: true,
      mood: "speak",
      tone: "neutral",
      message: `조건에 맞는 재료 ${input.visibleCount}개를 모아 뒀어요.`,
    };
  }

  if (input.expiredCount > 0) {
    return {
      show: true,
      mood: "worry",
      tone: "danger",
      message: `기한이 지난 재료 ${input.expiredCount}개부터 정리할까요?`,
      action: "show_expired",
    };
  }

  if (input.within7Count > 0) {
    return {
      show: true,
      mood: "speak",
      tone: "warning",
      message: `7일 안에 손볼 재료 ${input.within7Count}개를 확인할까요?`,
      action: "show_within7",
    };
  }

  return {
    show: true,
    mood: "happy",
    tone: "success",
    message: `재료 ${input.totalCount}개가 잘 정리되어 있어요.`,
  };
}

export function getInventoryHeroNotices(input: {
  hero: InventoryHeroNotice;
}): JangoHeroNoticeItem[] {
  if (!input.hero.show) {
    return [];
  }

  return [
    {
      id: "status",
      mood: input.hero.mood,
      message: input.hero.message,
      ...(input.hero.actionLabel
        ? { actionLabel: input.hero.actionLabel }
        : {}),
    },
  ];
}
