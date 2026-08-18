import type { MascotMood } from "../../components/Mascot";

export type RecommendationHeroStatus = {
  message: string;
  mood: MascotMood;
};

export function getRecommendationHeroStatus(input: {
  isGenerating: boolean;
  justGenerated: boolean;
  hasRecommendationResult: boolean;
  errorMessage?: string | null;
  isQuotaError: boolean;
  isCapacityError: boolean;
  canOfferRewardedAd: boolean;
}): RecommendationHeroStatus {
  if (input.isGenerating) {
    return {
      message: "냉장고를 들여다보는 중이에요. 다른 화면을 봐도 괜찮아요.",
      mood: "think",
    };
  }

  if (input.errorMessage) {
    return {
      message: getRecommendationErrorHeroMessage(input),
      mood: "worry",
    };
  }

  if (input.justGenerated) {
    return {
      message: "추천이 준비됐어요. 같이 살펴볼까요?",
      mood: "happy",
    };
  }

  if (input.hasRecommendationResult) {
    return {
      message:
        "이 요리들로 오늘을 채워볼까요? 조건만 바꿔도 다시 골라 드릴게요.",
      mood: "cooking",
    };
  }

  return {
    message:
      "오늘 뭐 해먹을까요? 임박 재료를 먼저 살피고 요리를 골라 드릴게요.",
    mood: "speak",
  };
}

export function getRecommendationErrorHeroMessage(input: {
  errorMessage?: string | null;
  isQuotaError: boolean;
  isCapacityError: boolean;
  canOfferRewardedAd: boolean;
}): string {
  if (input.isQuotaError) {
    return input.canOfferRewardedAd
      ? "아래 버튼만 누르면 광고 뒤에 추천을 바로 만들어 드릴게요."
      : "오늘의 추천 횟수를 다 썼어요. 내일 다시 부탁해도 괜찮아요.";
  }

  if (input.isCapacityError) {
    return input.errorMessage?.includes("너무 많")
      ? "요청이 몰렸어요. 조금만 뒤에 다시 눌러 주세요."
      : "지금은 추천을 잠시 멈춰 두었어요. 내일 다시 부탁해도 괜찮아요.";
  }

  const trimmed = input.errorMessage?.trim();
  return trimmed || "앗, 추천을 만들지 못했어요.";
}
