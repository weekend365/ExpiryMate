import type { MonetizationOfferKind } from "@expirymate/shared";

export const REWARDED_AD_CTA_LABEL = "광고 보고 추천 받을게요";

export function resolveMonetizationOffer(kind: MonetizationOfferKind) {
  switch (kind) {
    case "rewarded_ad":
      return { action: "rewarded_ad" as const, label: REWARDED_AD_CTA_LABEL };
    case "paid_credits":
      return { action: "paid_credits" as const, label: "AI 추천권 충전하기" };
    case "jango_household":
      return { action: "subscription" as const, label: "가족 플러스 살펴보기" };
    case "jango_plus":
      return { action: "subscription" as const, label: "장고 플러스 살펴보기" };
    default:
      return { action: "none" as const, label: "내일 다시 추천받기" };
  }
}
