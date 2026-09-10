import type { InventoryItemGroup } from "@expirymate/shared";
import type { MascotMood } from "../../components/Mascot";

export type HomeNoticeAction =
  | "retry"
  | "recommendations"
  | "expired"
  | "unknown"
  | "expiring"
  | "scanner"
  | "register";

export type HomeNotice = {
  id: string;
  message: string;
  mood: MascotMood;
  action?: HomeNoticeAction;
  actionHint?: string;
};

type RecipeGenerationStatus = "idle" | "pending" | "success" | "error";

export function getHomeNotices(input: {
  isInitialLoading: boolean;
  isInitialError: boolean;
  isRefreshError: boolean;
  loadErrorMessage: string;
  recipeStatus: RecipeGenerationStatus;
  recipeErrorMessage: string | null;
  expiringGroups: InventoryItemGroup[];
  expiredCount: number;
  within7DaysCount: number;
  unknownExpiryCount: number;
  hasInventory: boolean;
  hasLoaded: boolean;
}): HomeNotice[] {
  if (input.isInitialLoading) {
    return [];
  }

  if (input.isInitialError) {
    return [{
      id: "initial-error",
      message: `앗, 오늘 할 일을 불러오지 못했어요. ${summarizeLoadError(input.loadErrorMessage)}`,
      mood: "worry",
      action: "retry",
      actionHint: "다시 시도",
    }];
  }

  if (input.isRefreshError) {
    return [{
      id: "refresh-error",
      message: `앗, 최신 내용을 불러오지 못했어요. ${summarizeLoadError(input.loadErrorMessage)}`,
      mood: "worry",
      action: "retry",
      actionHint: "다시 시도",
    }];
  }

  if (input.hasLoaded && input.expiredCount > 0) {
    return [{
      id: "expired",
      message: `기한이 지난 재료 ${input.expiredCount}건의 상태를 먼저 확인해 주세요.`,
      mood: "worry",
      action: "expired",
      actionHint: "기한 지난 재료 확인",
    }];
  }

  if (input.hasLoaded && input.within7DaysCount > 0) {
    return [{
      id: "expiring",
      message: input.expiringGroups.length > 0
        ? getExpiringNoticeMessage(input.expiringGroups)
        : `7일 안에 기한이 오는 재료 ${input.within7DaysCount}건을 먼저 살펴보세요.`,
      mood: "speak",
      action: "expiring",
      actionHint: "보관함에 임박 재료 필터 적용",
    }];
  }

  if (input.hasLoaded && input.unknownExpiryCount > 0) {
    return [{
      id: "unknown",
      message: `재료 ${input.unknownExpiryCount}건의 기한을 확인해 주세요.`,
      mood: "speak",
      action: "unknown",
      actionHint: "기한 미입력 재료 확인",
    }];
  }

  if (input.recipeStatus === "pending") {
    return [{
      id: "recipe-pending",
      message: "요리 조합을 찾고 있어요. 다른 화면을 봐도 괜찮아요.",
      mood: "think",
    }];
  }

  if (input.recipeStatus === "error") {
    return [{
      id: "recipe-error",
      message:
        input.recipeErrorMessage ??
        "추천을 만들지 못했어요. 추천 탭에서 다시 시도해 주세요.",
      mood: "worry",
      action: "recommendations",
      actionHint: "추천 탭으로 이동",
    }];
  }

  if (input.recipeStatus === "success") {
    return [{
      id: "recipe-success",
      message: "추천이 준비됐어요. 같이 살펴볼까요?",
      mood: "happy",
      action: "recommendations",
      actionHint: "추천 보기",
    }];
  }

  if (input.hasLoaded && !input.hasInventory) {
    return [{
      id: "empty",
      message: "첫 재료를 넣으면 언제 챙겨야 할지 알려드릴게요.",
      mood: "empty",
      action: "register",
      actionHint: "재료 등록 방식 선택",
    }];
  }

  if (input.hasLoaded && input.hasInventory) {
    return [{
      id: "calm",
      message: "오늘은 급한 재료가 없어요. 보관 중인 재료를 살펴보세요.",
      mood: "speak",
    }];
  }

  return [];
}

export function getHeroTone(
  notice: HomeNotice | null,
): "primary" | "warning" | "danger" {
  if (!notice) {
    return "primary";
  }

  if (notice.mood === "worry") {
    return notice.action === "expiring" ? "warning" : "danger";
  }

  if (notice.id === "expiring") {
    return "warning";
  }

  return "primary";
}

function getExpiringNoticeMessage(groups: InventoryItemGroup[]) {
  const firstName = groups[0]?.displayName?.trim() || "재료";

  if (groups.length === 1) {
    return `${firstName}, 먼저 살펴볼까요?`;
  }

  return `${firstName} 외 ${groups.length - 1}개, 먼저 살펴볼까요?`;
}

function summarizeLoadError(message: string) {
  const trimmed = message.trim();

  if (!trimmed || trimmed.length > 48) {
    return "다시 불러와 볼까요?";
  }

  if (trimmed.endsWith("?") || trimmed.endsWith("요.")) {
    return trimmed;
  }

  return `${trimmed} 다시 불러와 볼까요?`;
}
