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

  if (input.isInitialLoading || input.isInitialError) {
    return { show: false };
  }

  if (
    input.totalCount === 0 ||
    input.visibleCount === 0 ||
    input.statusFilter !== "all"
  ) {
    return { show: false };
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

  return { show: false };
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
