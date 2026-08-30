import type { MascotMood } from "../../components/Mascot";

export type RecommendationHeroStatus = {
  message: string;
  mood: MascotMood;
};

export function selectRecommendationHeroIngredientNames(
  items: Array<{ displayName: string; expiryDate: string }>,
  limit = 2,
) {
  const seen = new Set<string>();
  return [...items]
    .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate))
    .flatMap((item) => {
      const name = item.displayName.trim();
      const key = name.toLocaleLowerCase("ko-KR");
      if (!name || seen.has(key)) return [];
      seen.add(key);
      return [name];
    })
    .slice(0, Math.max(0, limit));
}

export function getRecommendationHeroStatus(input: {
  isGenerating: boolean;
  justGenerated: boolean;
  hasRecommendationResult: boolean;
  errorMessage?: string | null;
  isQuotaError: boolean;
  isCapacityError: boolean;
  canOfferRewardedAd: boolean;
  useExpiringFirst?: boolean;
  hasSafetyPreferences?: boolean;
  needsIngredients?: boolean;
  ingredientNames?: string[];
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

  if (input.needsIngredients && !input.hasRecommendationResult) {
    return {
      message: "재료를 넣으면 오늘 요리를 골라 드릴게요.",
      mood: "speak",
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

  const useExpiringFirst = input.useExpiringFirst ?? true;

  if (input.hasSafetyPreferences) {
    return {
      message: useExpiringFirst
        ? "맞춤 설정을 지키면서 임박 재료부터 요리를 골라 드릴게요."
        : "맞춤 설정을 지키면서 보관 재료를 두루 살펴볼게요.",
      mood: "speak",
    };
  }

  if (useExpiringFirst && input.ingredientNames?.length) {
    return {
      message: `${input.ingredientNames.join(" · ")}부터 맛있게 쓸 방법을 찾아볼게요.`,
      mood: "speak",
    };
  }

  return {
    message: useExpiringFirst
      ? "오늘 뭐 해먹을까요? 임박 재료를 먼저 살피고 요리를 골라 드릴게요."
      : "오늘 뭐 해먹을까요? 보관 재료를 두루 살펴 요리를 골라 드릴게요.",
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
      : "오늘은 추천을 잠시 쉬어갈까요? 내일 다시 만나요.";
  }

  if (input.isCapacityError) {
    return input.errorMessage?.includes("너무 많")
      ? "요청이 몰렸어요. 조금만 뒤에 다시 눌러 주세요."
      : "지금은 추천을 잠시 멈춰 두었어요. 내일 다시 부탁해도 괜찮아요.";
  }

  const trimmed = input.errorMessage?.trim();
  if (
    trimmed === "추천 가능한 재료가 없습니다." ||
    trimmed?.includes("고를 재료가 없어요")
  ) {
    return "지금은 고를 재료가 없어요. 재료를 넣은 뒤 다시 부탁해 주세요.";
  }
  return trimmed || "앗, 추천을 만들지 못했어요.";
}
