import { z } from "zod";

export const monetizationPlatformSchema = z.enum(["ios", "android"]);
export const monetizationTierSchema = z.enum(["free", "jango_plus"]);
export const rewardedAdSessionStatusSchema = z.enum([
  "pending",
  "verified",
  "cancelled",
  "expired",
]);

export const monetizationExperimentVariantSchema = z.enum([
  "control",
  "value_first",
]);

export const monetizationFunnelEventNameSchema = z.enum([
  "quota_exhausted",
  "rewarded_ad_requested",
  "rewarded_ad_loaded",
  "rewarded_ad_opened",
  "rewarded_ad_earned",
  "rewarded_ad_verifying",
  "rewarded_ad_verified",
  "rewarded_ad_failed",
  "rewarded_credit_used",
  "paywall_viewed",
  "plan_selected",
  "checkout_started",
  "checkout_cancelled",
  "checkout_failed",
  "purchase_verified",
  "restore_started",
  "restore_completed",
  "restore_failed",
  "barcode_reward_granted",
  "barcode_reward_denied",
  "barcode_reward_used",
]);

export const trackMonetizationEventRequestSchema = z.object({
  event: monetizationFunnelEventNameSchema,
  properties: z
    .record(z.string().max(40), z.string().max(120))
    .refine((value) => Object.keys(value).length <= 12, {
      message: "Too many monetization event properties.",
    })
    .optional(),
});

export const recommendationAccessSchema = z.object({
  day: z.string(),
  timezone: z.literal("Asia/Seoul"),
  resetsAt: z.string(),
  tier: monetizationTierSchema,
  rewardedAdsEnabled: z.boolean(),
  subscriptionsEnabled: z.boolean(),
  experiment: z.object({
    key: z.literal("monetization-v1"),
    variant: monetizationExperimentVariantSchema,
    defaultBillingPeriod: z.enum(["monthly", "yearly"]),
  }),
  dailyLimit: z.number().int().nonnegative(),
  subscriberDailyLimit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  free: z.object({
    limit: z.number().int().nonnegative(),
    used: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  }),
  rewardedAds: z.object({
    dailyLimit: z.number().int().nonnegative(),
    verified: z.number().int().nonnegative(),
    creditsAvailable: z.number().int().nonnegative(),
    remainingToWatch: z.number().int().nonnegative(),
    canWatch: z.boolean(),
  }),
  contributionRewards: z.object({
    enabled: z.boolean(),
    balance: z.number().int().nonnegative(),
    earnedToday: z.number().int().nonnegative(),
    dailyLimit: z.number().int().nonnegative(),
    balanceLimit: z.number().int().nonnegative(),
    canEarn: z.boolean(),
  }),
});

export const createRewardedAdSessionRequestSchema = z.object({
  platform: monetizationPlatformSchema,
});

export const rewardedAdSessionSchema = z.object({
  id: z.string(),
  status: rewardedAdSessionStatusSchema,
  userIdentifier: z.string(),
  customData: z.string(),
  showExpiresAt: z.string(),
  verificationExpiresAt: z.string(),
  access: recommendationAccessSchema,
});

export type MonetizationPlatform = z.infer<typeof monetizationPlatformSchema>;
export type MonetizationTier = z.infer<typeof monetizationTierSchema>;
export type RewardedAdSessionStatus = z.infer<
  typeof rewardedAdSessionStatusSchema
>;
export type MonetizationExperimentVariant = z.infer<
  typeof monetizationExperimentVariantSchema
>;
export type MonetizationFunnelEventName = z.infer<
  typeof monetizationFunnelEventNameSchema
>;
export type TrackMonetizationEventRequest = z.infer<
  typeof trackMonetizationEventRequestSchema
>;
export type RecommendationAccess = z.infer<typeof recommendationAccessSchema>;
export type CreateRewardedAdSessionRequest = z.infer<
  typeof createRewardedAdSessionRequestSchema
>;
export type RewardedAdSession = z.infer<typeof rewardedAdSessionSchema>;
