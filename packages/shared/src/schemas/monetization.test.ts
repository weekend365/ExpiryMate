import { describe, expect, it } from "vitest";
import {
  recommendationAccessSchema,
  trackMonetizationEventRequestSchema,
} from "./monetization";

describe("monetization schemas", () => {
  it("accepts server-assigned experiment metadata in recommendation access", () => {
    expect(
      recommendationAccessSchema.parse({
        day: "2026-08-07",
        timezone: "Asia/Seoul",
        resetsAt: "2026-08-07T15:00:00.000Z",
        tier: "free",
        usageScope: { type: "user", spaceId: null },
        rewardedAdsEnabled: true,
        subscriptionsEnabled: true,
        householdSubscriptionsEnabled: true,
        experiment: {
          key: "monetization-v1",
          variant: "value_first",
          defaultBillingPeriod: "monthly",
        },
        dailyLimit: 4,
        subscriberDailyLimit: 30,
        householdDailyLimit: 60,
        used: 0,
        remaining: 2,
        free: { limit: 2, used: 0, remaining: 2 },
        rewardedAds: {
          dailyLimit: 2,
          verified: 0,
          creditsAvailable: 0,
          remainingToWatch: 2,
          canWatch: false,
        },
        contributionRewards: {
          enabled: true,
          balance: 2,
          earnedToday: 1,
          dailyLimit: 3,
          balanceLimit: 10,
          canEarn: true,
        },
        paidCredits: {
          enabled: true,
          salesEnabled: true,
          balance: 5,
          products: [{ productId: "credits_5", credits: 5 }],
        },
        offer: {
          kind: "rewarded_ad",
          reason: "casual",
          personalized: true,
          alternatives: ["jango_plus"],
        },
      }).experiment.variant,
    ).toBe("value_first");
  });

  it("rejects arbitrary or oversized funnel payloads", () => {
    expect(
      trackMonetizationEventRequestSchema.safeParse({
        event: "purchase_token_uploaded",
      }).success,
    ).toBe(false);
    expect(
      trackMonetizationEventRequestSchema.safeParse({
        event: "affiliate_offer_shown",
        properties: { count: "2", mode: "partner_link" },
      }).success,
    ).toBe(true);
    expect(
      trackMonetizationEventRequestSchema.safeParse({
        event: "paywall_viewed",
        properties: Object.fromEntries(
          Array.from({ length: 13 }, (_, index) => [`key_${index}`, "value"]),
        ),
      }).success,
    ).toBe(false);
  });
});
