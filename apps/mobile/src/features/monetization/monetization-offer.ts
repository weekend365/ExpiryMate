import type { MonetizationOfferKind } from "@expirymate/shared";

export function resolveMonetizationOffer(kind: MonetizationOfferKind) {
  switch (kind) {
    case "rewarded_ad":
      return { action: "rewarded_ad" as const, label: "광고 보고 추천 1회 받기" };
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
