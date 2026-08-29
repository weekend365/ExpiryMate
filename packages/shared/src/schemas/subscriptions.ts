import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const subscriptionStoreSchema = z.enum([
  "apple_app_store",
  "google_play",
]);

export const subscriptionEntitlementStatusSchema = z.enum([
  "active",
  "grace_period",
  "billing_retry",
  "paused",
  "expired",
  "revoked",
  "unknown",
]);

export const subscriptionEntitlementSchema = z.object({
  hasActiveEntitlement: z.boolean(),
  store: subscriptionStoreSchema.nullable(),
  productId: z.string().nullable(),
  planCode: z.enum(["jango_plus", "jango_household"]).nullable(),
  scope: z.enum(["user", "space"]),
  spaceId: z.string().nullable(),
  billingPeriod: z.enum(["monthly", "yearly"]).nullable(),
  basePlanId: z.string().nullable(),
  status: subscriptionEntitlementStatusSchema,
  expiresAt: z.string().nullable(),
  willRenew: z.boolean().nullable(),
  environment: z.string().nullable(),
  verifiedAt: z.string().nullable(),
});

export const subscriptionVerificationRequestSchema = z.object({
  store: subscriptionStoreSchema,
  productId: z
    .string()
    .min(1)
    .max(fieldLimits.subscriptionProductId)
    .optional(),
  transactionId: z
    .string()
    .min(1)
    .max(fieldLimits.subscriptionTransactionId)
    .optional(),
  purchaseToken: z
    .string()
    .min(1)
    .max(fieldLimits.subscriptionPurchaseToken)
    .optional(),
  basePlanId: z.string().min(1).max(128).optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
  spaceId: z.string().min(1).max(128).optional(),
  purchaseIntentId: z.string().min(1).max(128).optional(),
});

export const subscriptionPurchaseIntentRequestSchema = z.object({
  store: subscriptionStoreSchema,
  productId: z.string().min(1).max(fieldLimits.subscriptionProductId),
});

export const subscriptionPurchaseIntentSchema = z.object({
  id: z.string(),
  store: subscriptionStoreSchema,
  productId: z.string(),
  appleAppAccountToken: z.string().uuid(),
  googleObfuscatedAccountId: z.string().min(1).max(64),
  expiresAt: z.string(),
});

export const subscriptionVerificationResponseSchema = z.object({
  ok: z.literal(true),
  entitlement: subscriptionEntitlementSchema,
});

export type SubscriptionStore = z.infer<typeof subscriptionStoreSchema>;
export type SubscriptionEntitlementStatus = z.infer<
  typeof subscriptionEntitlementStatusSchema
>;
export type SubscriptionEntitlement = z.infer<typeof subscriptionEntitlementSchema>;
export type SubscriptionVerificationRequest = z.infer<
  typeof subscriptionVerificationRequestSchema
>;
export type SubscriptionVerificationResponse = z.infer<
  typeof subscriptionVerificationResponseSchema
>;
export type SubscriptionPurchaseIntentRequest = z.infer<
  typeof subscriptionPurchaseIntentRequestSchema
>;
export type SubscriptionPurchaseIntent = z.infer<
  typeof subscriptionPurchaseIntentSchema
>;
