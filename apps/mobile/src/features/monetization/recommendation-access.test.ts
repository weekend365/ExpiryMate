import { describe, expect, it } from "vitest";
import type { RecommendationAccess } from "@expirymate/shared";
import {
  canContinueWithRewardedAd,
  needsRewardedAdToRecommend,
  parseRecommendationAccess,
} from "./recommendation-access";

function access(
  overrides: {
    rewardedAdsEnabled?: boolean;
    free?: Partial<RecommendationAccess["free"]>;
    rewardedAds?: Partial<RecommendationAccess["rewardedAds"]>;
  } = {},
): RecommendationAccess {
  return {
    day: "2026-08-16",
    timezone: "Asia/Seoul",
    resetsAt: "2026-08-16T15:00:00.000Z",
    tier: "free",
    usageScope: { type: "user", spaceId: null },
    rewardedAdsEnabled: overrides.rewardedAdsEnabled ?? true,
    subscriptionsEnabled: false,
    householdSubscriptionsEnabled: false,
    experiment: {
      key: "monetization-v1",
      variant: "control",
      defaultBillingPeriod: "yearly",
    },
    dailyLimit: 11,
    subscriberDailyLimit: 30,
    householdDailyLimit: 60,
    used: 1,
    remaining: 10,
    free: { limit: 1, used: 1, remaining: 0, ...overrides.free },
    rewardedAds: {
      dailyLimit: 10,
      verified: 0,
      creditsAvailable: 0,
      remainingToWatch: 10,
      canWatch: true,
      ...overrides.rewardedAds,
    },
    contributionRewards: {
      enabled: false,
      balance: 0,
      earnedToday: 0,
      dailyLimit: 3,
      balanceLimit: 10,
      canEarn: false,
    },
    paidCredits: {
      enabled: false,
      salesEnabled: false,
      balance: 0,
      products: [],
    },
    offer: {
      kind: "none",
      reason: "unavailable",
      personalized: false,
      alternatives: [],
    },
  };
}

describe("recommendation access helpers", () => {
  it("keeps the ad continuation open when remaining ads exist but canWatch is stale", () => {
    const stale = access({
      rewardedAds: { canWatch: false, remainingToWatch: 9 },
    });

    expect(canContinueWithRewardedAd(stale)).toBe(true);
    expect(needsRewardedAdToRecommend(stale)).toBe(true);
  });

  it("does not offer ads when the rewarded-ad flag is off", () => {
    const disabled = access({
      rewardedAdsEnabled: false,
      rewardedAds: {
        dailyLimit: 0,
        verified: 0,
        creditsAvailable: 0,
        remainingToWatch: 0,
        canWatch: false,
      },
    });

    expect(canContinueWithRewardedAd(disabled)).toBe(false);
    expect(needsRewardedAdToRecommend(disabled)).toBe(false);
  });

  it("does not require an ad when a spendable credit still remains", () => {
    const withCredit = access({
      rewardedAds: { creditsAvailable: 1, canWatch: true, remainingToWatch: 9 },
    });

    expect(canContinueWithRewardedAd(withCredit)).toBe(true);
    expect(needsRewardedAdToRecommend(withCredit)).toBe(false);
  });

  it("hydrates recommendation access from a quota-error payload", () => {
    expect(parseRecommendationAccess(access())).not.toBeNull();
    expect(parseRecommendationAccess({ reason: "owner_daily_cost_limit" })).toBeNull();
  });
});
