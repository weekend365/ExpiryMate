import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const COUPANG_PARTNERS_DISCLOSURE =
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export const COUPANG_PARTNERS_CTA_LABEL = "쿠팡에서 보기";

export const affiliateProviderSchema = z.literal("coupang_partners");

export const affiliateTrackingModeSchema = z.enum([
  "none",
  "partner_link",
  "deeplink",
]);

export const affiliatePresentationSchema = z.enum([
  "product_search",
  "deeplink_fallback",
  "partner_link",
  "none",
]);

export const affiliatePlacementSchema = z.enum([
  "recipe_missing_ingredient",
  "shopping_recently_consumed",
  "shopping_search",
  "inventory_consumed",
  "cooking_complete",
  "recipe_optional_entry",
  "home_reorder_preview",
]);

export const affiliateContextualSearchPlacementSchema = z.enum([
  "shopping_search",
  "inventory_consumed",
  "cooking_complete",
  "recipe_optional_entry",
  "home_reorder_preview",
]);

export const affiliateOfferSchema = z.object({
  ingredientName: z.string().min(1).max(fieldLimits.recipeIngredientName),
  reason: z.string().min(1).max(fieldLimits.recipeText),
  query: z.string().min(1).max(fieldLimits.recipeIngredientName),
  landingUrl: z.string().url(),
  tracked: z.boolean(),
});

export const affiliateProductSchema = z.object({
  productId: z.string().min(1).max(64),
  productName: z.string().min(1).max(300),
  productImage: z.string().url(),
  productUrl: z.string().url(),
  productPrice: z.number().int().nonnegative().nullable(),
  isRocket: z.boolean(),
  isFreeShipping: z.boolean(),
  observedAt: z.string().datetime(),
  stale: z.boolean(),
});

export const affiliateProductGroupSchema = z.object({
  ingredientName: z.string().min(1).max(fieldLimits.recipeIngredientName),
  reason: z.string().max(fieldLimits.recipeText),
  query: z.string().min(1).max(fieldLimits.recipeIngredientName),
  placement: affiliatePlacementSchema,
  products: z.array(affiliateProductSchema).max(3),
  fallbackUrl: z.string().url().nullable(),
});

export const affiliateOffersResponseSchema = z.object({
  enabled: z.boolean(),
  provider: affiliateProviderSchema,
  trackingMode: affiliateTrackingModeSchema,
  presentation: affiliatePresentationSchema.default("none"),
  disclosure: z.string().min(1),
  offers: z.array(affiliateOfferSchema).max(2),
  productGroups: z.array(affiliateProductGroupSchema).max(2).default([]),
});

export const affiliateProductSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(fieldLimits.recipeIngredientName),
  placement: affiliateContextualSearchPlacementSchema,
});

export const affiliateProductSearchResponseSchema = z.object({
  enabled: z.boolean(),
  provider: affiliateProviderSchema,
  presentation: affiliatePresentationSchema,
  disclosure: z.string().min(1),
  group: affiliateProductGroupSchema.nullable(),
});

export const affiliateShoppingResponseSchema = z.object({
  enabled: z.boolean(),
  provider: affiliateProviderSchema,
  disclosure: z.string().min(1),
  recentResolvedCount: z.number().int().nonnegative().optional(),
  /** @deprecated Use recentResolvedCount. Retained for older mobile clients. */
  recentConsumedCount: z.number().int().nonnegative().optional(),
  productGroups: z.array(affiliateProductGroupSchema).max(9),
});

export const affiliateReorderPreviewKindSchema = z.enum([
  "recently_consumed",
  "repeat_purchase_due",
]);

export const affiliateReorderPreviewResponseSchema = z.object({
  enabled: z.boolean(),
  provider: affiliateProviderSchema,
  disclosure: z.string().min(1),
  kind: affiliateReorderPreviewKindSchema.nullable(),
  cadenceDays: z.number().int().positive().nullable(),
  lastConsumedAt: z.string().datetime().nullable(),
  group: affiliateProductGroupSchema.nullable(),
});

export type AffiliateProvider = z.infer<typeof affiliateProviderSchema>;
export type AffiliateTrackingMode = z.infer<typeof affiliateTrackingModeSchema>;
export type AffiliatePresentation = z.infer<typeof affiliatePresentationSchema>;
export type AffiliatePlacement = z.infer<typeof affiliatePlacementSchema>;
export type AffiliateContextualSearchPlacement = z.infer<
  typeof affiliateContextualSearchPlacementSchema
>;
export type AffiliateOffer = z.infer<typeof affiliateOfferSchema>;
export type AffiliateProduct = z.infer<typeof affiliateProductSchema>;
export type AffiliateProductGroup = z.infer<typeof affiliateProductGroupSchema>;
export type AffiliateOffersResponse = z.infer<
  typeof affiliateOffersResponseSchema
>;
export type AffiliateProductSearchRequest = z.infer<
  typeof affiliateProductSearchRequestSchema
>;
export type AffiliateProductSearchResponse = z.infer<
  typeof affiliateProductSearchResponseSchema
>;
export type AffiliateShoppingResponse = z.infer<
  typeof affiliateShoppingResponseSchema
>;
export type AffiliateReorderPreviewKind = z.infer<
  typeof affiliateReorderPreviewKindSchema
>;
export type AffiliateReorderPreviewResponse = z.infer<
  typeof affiliateReorderPreviewResponseSchema
>;
