import type { InventoryItemGroup } from "@expirymate/shared";
import type { MascotMood } from "../../components/Mascot";

export type HomeNoticeAction =
  | "retry"
  | "recommendations"
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
  hasInventory: boolean;
  hasLoaded: boolean;
}): HomeNotice[] {
  const notices: HomeNotice[] = [];

  if (input.isInitialLoading) {
    notices.push({
      id: "loading",
      message: "보관함을 살펴보고 있어요. 조금만 기다려 주세요.",
      mood: "think",
    });
    return notices;
  }

  if (input.isInitialError) {
    notices.push({
      id: "initial-error",
      message: `앗, 오늘 할 일을 불러오지 못했어요. ${summarizeLoadError(input.loadErrorMessage)}`,
      mood: "worry",
      action: "retry",
      actionHint: "다시 불러올게요",
    });
    return notices;
  }

  if (input.recipeStatus === "pending") {
    notices.push({
      id: "recipe-pending",
      message: "요리 조합을 찾고 있어요. 다른 화면을 봐도 괜찮아요.",
      mood: "think",
    });
  } else if (input.recipeStatus === "success") {
    notices.push({
      id: "recipe-success",
      message: "추천이 준비됐어요. 같이 살펴볼까요?",
      mood: "happy",
      action: "recommendations",
      actionHint: "추천 보러 갈게요",
    });
  } else if (input.recipeStatus === "error") {
    notices.push({
      id: "recipe-error",
      message:
        input.recipeErrorMessage ??
        "추천을 만들지 못했어요. 추천 탭에서 다시 해볼까요?",
      mood: "worry",
      action: "recommendations",
      actionHint: "추천 탭으로 갈게요",
    });
  }

  if (input.isRefreshError) {
    notices.push({
      id: "refresh-error",
      message: `앗, 최신 내용을 불러오지 못했어요. ${summarizeLoadError(input.loadErrorMessage)}`,
      mood: "worry",
      action: "retry",
      actionHint: "다시 불러올게요",
    });
  }

  if (input.hasLoaded && input.expiringGroups.length > 0) {
    notices.push({
      id: "expiring",
      message: getExpiringNoticeMessage(input.expiringGroups),
      mood: "speak",
      action: "expiring",
      actionHint: "보관함에서 임박한 재료만 보여 드릴게요.",
    });
  } else if (input.hasLoaded && !input.hasInventory) {
    notices.push({
      id: "empty",
      message: "냉장고가 비어 있어요. 바코드만 비춰도 첫 재료를 넣을 수 있어요.",
      mood: "empty",
      action: "scanner",
      actionHint: "바코드로 넣을래요",
    });
  } else if (
    input.hasLoaded &&
    input.hasInventory &&
    input.expiringGroups.length === 0 &&
    notices.length === 0
  ) {
    notices.push({
      id: "calm",
      message: "오늘은 급한 재료가 없어요. 여유 있을 때 재료를 더 넣어볼까요?",
      mood: "speak",
    });
  }

  return notices;
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
