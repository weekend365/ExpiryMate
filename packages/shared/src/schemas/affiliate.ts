import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const COUPANG_PARTNERS_DISCLOSURE =
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export const affiliateProviderSchema = z.literal("coupang_partners");

export const affiliateTrackingModeSchema = z.enum([
  "none",
  "partner_link",
  "deeplink",
]);

export const affiliateOfferSchema = z.object({
  ingredientName: z.string().min(1).max(fieldLimits.recipeIngredientName),
  reason: z.string().min(1).max(fieldLimits.recipeText),
  query: z.string().min(1).max(fieldLimits.recipeIngredientName),
  landingUrl: z.string().url(),
  tracked: z.boolean(),
});

export const affiliateOffersResponseSchema = z.object({
  enabled: z.boolean(),
  provider: affiliateProviderSchema,
  trackingMode: affiliateTrackingModeSchema,
  disclosure: z.string().min(1),
  offers: z.array(affiliateOfferSchema).max(2),
});

export type AffiliateProvider = z.infer<typeof affiliateProviderSchema>;
export type AffiliateTrackingMode = z.infer<typeof affiliateTrackingModeSchema>;
export type AffiliateOffer = z.infer<typeof affiliateOfferSchema>;
export type AffiliateOffersResponse = z.infer<
  typeof affiliateOffersResponseSchema
>;
