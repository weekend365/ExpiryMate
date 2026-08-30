import { describe, expect, it } from "vitest";
import {
  getRecommendationHeroStatus,
  selectRecommendationHeroIngredientNames,
} from "./recommendation-hero";

const idle = {
  isGenerating: false,
  justGenerated: false,
  hasRecommendationResult: false,
  isQuotaError: false,
  isCapacityError: false,
  canOfferRewardedAd: false,
};

describe("getRecommendationHeroStatus", () => {
  it("keeps generating copy while a request is in flight", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        isGenerating: true,
        errorMessage: "추천을 만들지 못했어요",
      }),
    ).toEqual({
      message: "냉장고를 들여다보는 중이에요. 다른 화면을 봐도 괜찮아요.",
      mood: "think",
    });
  });

  it("lets the hero own quota failure copy", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        errorMessage: "오늘의 추천 횟수를 다 썼어요",
        isQuotaError: true,
      }),
    ).toEqual({
      message: "오늘은 추천을 잠시 쉬어갈까요? 내일 다시 만나요.",
      mood: "worry",
    });

    expect(
      getRecommendationHeroStatus({
        ...idle,
        errorMessage: "오늘의 추천 횟수를 다 썼어요",
        isQuotaError: true,
        canOfferRewardedAd: true,
      }),
    ).toEqual({
      message: "아래 버튼만 누르면 광고 뒤에 추천을 바로 만들어 드릴게요.",
      mood: "worry",
    });
  });

  it("lets the hero own capacity and generic failure copy", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        errorMessage: "요청이 너무 많아요",
        isCapacityError: true,
      }),
    ).toEqual({
      message: "요청이 몰렸어요. 조금만 뒤에 다시 눌러 주세요.",
      mood: "worry",
    });

    expect(
      getRecommendationHeroStatus({
        ...idle,
        hasRecommendationResult: true,
        errorMessage: "재료가 부족해요. 냉장고에 재료를 더 넣어 주세요.",
      }),
    ).toEqual({
      message: "재료가 부족해요. 냉장고에 재료를 더 넣어 주세요.",
      mood: "worry",
    });
  });

  it("uses idle copy when there is no error", () => {
    expect(getRecommendationHeroStatus(idle)).toEqual({
      message:
        "오늘 뭐 해먹을까요? 임박 재료를 먼저 살피고 요리를 골라 드릴게요.",
      mood: "speak",
    });
  });

  it("uses the nearest-expiry ingredients as the idle hero context", () => {
    expect(
      selectRecommendationHeroIngredientNames([
        { displayName: "우유", expiryDate: "2026-09-03" },
        { displayName: "두부", expiryDate: "2026-09-01" },
        { displayName: " 두부 ", expiryDate: "2026-09-02" },
        { displayName: "대파", expiryDate: "2026-09-02" },
      ]),
    ).toEqual(["두부", "대파"]);

    expect(
      getRecommendationHeroStatus({
        ...idle,
        ingredientNames: ["두부", "대파"],
      }),
    ).toEqual({
      message: "두부 · 대파부터 맛있게 쓸 방법을 찾아볼게요.",
      mood: "speak",
    });
  });

  it("does not name raw inventory when safety preferences are active", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        hasSafetyPreferences: true,
        ingredientNames: ["우유"],
      }),
    ).toEqual({
      message: "맞춤 설정을 지키면서 임박 재료부터 요리를 골라 드릴게요.",
      mood: "speak",
    });
  });

  it("removes expiry-first copy when the option is off", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        useExpiringFirst: false,
        ingredientNames: ["두부"],
      }),
    ).toEqual({
      message: "오늘 뭐 해먹을까요? 보관 재료를 두루 살펴 요리를 골라 드릴게요.",
      mood: "speak",
    });
  });

  it("asks to add ingredients when the fridge is empty", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        needsIngredients: true,
      }),
    ).toEqual({
      message: "재료를 넣으면 오늘 요리를 골라 드릴게요.",
      mood: "speak",
    });
  });

  it("rewrites the empty-inventory API error into product copy", () => {
    expect(
      getRecommendationHeroStatus({
        ...idle,
        errorMessage: "추천 가능한 재료가 없습니다.",
      }),
    ).toEqual({
      message: "지금은 고를 재료가 없어요. 재료를 넣은 뒤 다시 부탁해 주세요.",
      mood: "worry",
    });
  });
});
