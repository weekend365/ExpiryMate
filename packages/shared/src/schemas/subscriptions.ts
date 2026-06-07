import { z } from "zod";

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
  status: subscriptionEntitlementStatusSchema,
  expiresAt: z.string().nullable(),
  willRenew: z.boolean().nullable(),
  environment: z.string().nullable(),
  verifiedAt: z.string().nullable(),
});

export const subscriptionVerificationRequestSchema = z.object({
  store: subscriptionStoreSchema,
  productId: z.string().min(1).optional(),
  transactionId: z.string().min(1).optional(),
  purchaseToken: z.string().min(1).optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
});

export const subscriptionVerificationResponseSchema = z.object({
  ok: z.literal(true),
  entitlement: subscriptionEntitlementSchema,
});
