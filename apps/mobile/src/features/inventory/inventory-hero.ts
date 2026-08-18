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
    return { show: false };
  }

  if (input.isInitialLoading) {
    return {
      show: true,
      mood: "think",
      tone: "neutral",
      message: "보관함을 살펴보고 있어요.",
    };
  }

  if (input.isInitialError) {
    return { show: false };
  }

  if (input.totalCount === 0) {
    return { show: false };
  }

  if (input.visibleCount === 0) {
    return {
      show: true,
      mood: "idle",
      tone: "neutral",
      message: "이 조건에는 재료가 없어요. 조건을 풀어 볼까요?",
    };
  }

  if (input.statusFilter === "expired") {
    return {
      show: true,
      mood: "worry",
      tone: "danger",
      message: `만료된 재료 ${input.visibleCount}개를 보고 있어요.`,
    };
  }

  if (input.statusFilter === "within7") {
    return {
      show: true,
      mood: "speak",
      tone: "warning",
      message: `일주일 안에 손볼 재료 ${input.visibleCount}개를 보고 있어요.`,
    };
  }

  if (input.statusFilter === "safe") {
    return {
      show: true,
      mood: "happy",
      tone: "success",
      message: `여유 있는 재료 ${input.visibleCount}개를 보고 있어요.`,
    };
  }

  if (input.expiredCount > 0) {
    return {
      show: true,
      mood: "worry",
      tone: "danger",
      message: `기한이 지난 재료가 ${input.expiredCount}개 있어요. 위에서부터 손보면 좋아요.`,
    };
  }

  if (input.within7Count > 0) {
    return {
      show: true,
      mood: "speak",
      tone: "warning",
      message: `일주일 안에 손볼 재료가 ${input.within7Count}개 있어요.`,
    };
  }

  return {
    show: true,
    mood: "happy",
    tone: "success",
    message: "지금은 급한 재료가 없어요.",
  };
}

export function getInventoryHeroNotices(input: {
  hero: InventoryHeroNotice;
  successMessage?: string | null;
}): JangoHeroNoticeItem[] {
  if (!input.hero.show) {
    return [];
  }

  const notices: JangoHeroNoticeItem[] = [];
  const successMessage = input.successMessage?.trim();

  if (successMessage) {
    notices.push({
      id: "success",
      mood: "happy",
      message: successMessage,
    });
  }

  notices.push({
    id: "status",
    mood: input.hero.mood,
    message: input.hero.message,
    supportingMessage: input.hero.supportingMessage,
  });

  return notices;
}
