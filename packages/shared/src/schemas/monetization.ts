import { z } from "zod";

export const monetizationPlatformSchema = z.enum(["ios", "android"]);
export const monetizationTierSchema = z.enum(["free", "jango_plus"]);
export const rewardedAdSessionStatusSchema = z.enum([
  "pending",
  "verified",
  "cancelled",
  "expired",
]);

export const recommendationAccessSchema = z.object({
  day: z.string(),
  timezone: z.literal("Asia/Seoul"),
  resetsAt: z.string(),
  tier: monetizationTierSchema,
  rewardedAdsEnabled: z.boolean(),
  subscriptionsEnabled: z.boolean(),
  dailyLimit: z.number().int().nonnegative(),
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
export type RecommendationAccess = z.infer<typeof recommendationAccessSchema>;
export type CreateRewardedAdSessionRequest = z.infer<
  typeof createRewardedAdSessionRequestSchema
>;
export type RewardedAdSession = z.infer<typeof rewardedAdSessionSchema>;
