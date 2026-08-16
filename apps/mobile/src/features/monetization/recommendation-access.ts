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
