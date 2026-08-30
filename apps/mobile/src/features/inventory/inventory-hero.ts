import type { JangoHeroNoticeItem } from "../../components/JangoHeroNoticeCarousel";
import type { MascotMood } from "../../components/Mascot";
import type { InventoryViewFilter } from "./filters";

export type InventoryHeroTone = "danger" | "warning" | "success" | "neutral";

export type InventoryHeroNotice =
  | { show: false }
  | {
      show: true;
      mood: MascotMood;
      tone: InventoryHeroTone;
      message: string;
      supportingMessage?: string;
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
      supportingMessage: "여러 재료를 한 번에 정리할 수 있어요.",
    };
  }

  if (input.isInitialLoading) {
    return {
      show: true,
      mood: "think",
      tone: "neutral",
      message: "보관함을 살펴보고 있어요. 조금만 기다려 주세요.",
    };
  }

  if (input.isInitialError) {
    return {
      show: true,
      mood: "worry",
      tone: "danger",
      message: "앗, 보관함을 불러오지 못했어요. 다시 살펴볼까요?",
    };
  }

  if (input.totalCount === 0) {
    return {
      show: true,
      mood: "empty",
      tone: "neutral",
      message: "아직 넣어둔 재료가 없어요. 첫 재료를 넣어 볼까요?",
    };
  }

  if (input.visibleCount === 0) {
    return {
      show: true,
      mood: "idle",
      tone: "neutral",
      message: "지금 고른 조건에 맞는 재료가 없어요.",
      supportingMessage: "검색어나 필터를 바꾸면 다시 찾아볼게요.",
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
      supportingMessage: "눌러서 만료된 재료만 모아 볼 수 있어요.",
    };
  }

  if (input.within7Count > 0) {
    return {
      show: true,
      mood: "speak",
      tone: "warning",
      message: `7일 안에 손볼 재료 ${input.within7Count}개를 확인할까요?`,
      supportingMessage: "눌러서 곧 만료되는 재료만 모아 볼 수 있어요.",
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
      supportingMessage: input.hero.supportingMessage,
    },
  ];
}
