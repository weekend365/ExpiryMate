import {
  recommendationAccessSchema,
  type RecommendationAccess,
} from "@expirymate/shared";

export function parseRecommendationAccess(
  details: unknown,
): RecommendationAccess | null {
  const parsed = recommendationAccessSchema.safeParse(details);
  return parsed.success ? parsed.data : null;
}

export function canContinueWithRewardedAd(
  access: RecommendationAccess | undefined,
) {
  if (!access || access.tier !== "free" || !access.rewardedAdsEnabled) {
    return false;
  }

  return (
    access.rewardedAds.canWatch || access.rewardedAds.remainingToWatch > 0
  );
}

export function needsRewardedAdToRecommend(
  access: RecommendationAccess | undefined,
) {
  if (!canContinueWithRewardedAd(access) || !access) {
    return false;
  }

  return (
    access.free.remaining <= 0 &&
    access.rewardedAds.creditsAvailable <= 0 &&
    access.paidCredits.balance <= 0 &&
    access.contributionRewards.balance <= 0
  );
}

export function canGenerateWithoutRewardedAd(
  access: RecommendationAccess | undefined,
) {
  if (!access) {
    return false;
  }
  if (access.tier !== "free") {
    return access.remaining > 0;
  }

  return (
    access.free.remaining > 0 ||
    access.rewardedAds.creditsAvailable > 0 ||
    access.paidCredits.balance > 0 ||
    access.contributionRewards.balance > 0
  );
}

/** Ad, barcode, and paid credits shown as one "추천권" balance. */
export function unifiedRecommendationCredits(access: RecommendationAccess) {
  const barcodeCredits = access.contributionRewards.enabled
    ? access.contributionRewards.balance
    : 0;

  return (
    access.rewardedAds.creditsAvailable +
    barcodeCredits +
    access.paidCredits.balance
  );
}

export function recommendationQuotaCopy(access: RecommendationAccess) {
  if (access.tier !== "free") {
    const quota = access.subscriptionQuota;
    return {
      label: "추천 횟수",
      value: quota
        ? `이번 달 ${quota.monthly.remaining}회 · 오늘 ${quota.daily.remaining}회 남음`
        : `오늘 ${access.remaining}회 남음`,
    };
  }

  const bonus = unifiedRecommendationCredits(access);
  const freeRemaining = access.free.remaining;

  if (freeRemaining > 0 && bonus > 0) {
    return {
      label: "추천 횟수",
      value: `무료 ${freeRemaining}회 · 추천권 ${bonus}회`,
    };
  }

  if (bonus > 0) {
    return {
      label: "추천 횟수",
      value: `추천권 ${bonus}회`,
    };
  }

  if (freeRemaining > 0) {
    return {
      label: "추천 횟수",
      value: `오늘 ${freeRemaining}회 남음`,
    };
  }

  return {
    label: "추천 횟수",
    value: "오늘 횟수를 다 썼어요",
  };
}
