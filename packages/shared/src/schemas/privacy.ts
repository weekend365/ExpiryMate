import { z } from "zod";

export const privacyStatusSchema = z.object({
  privacyPolicyUrl: z.string(),
  privacyChoicesUrl: z.string(),
  contactEmail: z.string(),
  aiDataNoticeVersion: z.string(),
  aiDataNoticeAcceptedAt: z.string().nullable(),
  hasAcceptedCurrentAiDataNotice: z.boolean(),
  recommendationHistoryCount: z.number().int().nonnegative(),
});

export const acceptAiDataNoticeResponseSchema = z.object({
  ok: z.literal(true),
  status: privacyStatusSchema,
});

export const revokeAiDataNoticeResponseSchema = z.object({
  ok: z.literal(true),
  status: privacyStatusSchema,
});

export const deleteRecommendationHistoryResponseSchema = z.object({
  ok: z.literal(true),
  deletedCount: z.number().int().nonnegative(),
  status: privacyStatusSchema,
});

export const deleteAccountRequestSchema = z.object({
  confirmation: z.literal("삭제"),
});

export const deleteAccountResponseSchema = z.object({
  ok: z.literal(true),
  deletedAt: z.string(),
});

export type PrivacyStatus = z.infer<typeof privacyStatusSchema>;
export type AcceptAiDataNoticeResponse = z.infer<
  typeof acceptAiDataNoticeResponseSchema
>;
export type RevokeAiDataNoticeResponse = z.infer<
  typeof revokeAiDataNoticeResponseSchema
>;
export type DeleteRecommendationHistoryResponse = z.infer<
  typeof deleteRecommendationHistoryResponseSchema
>;
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;
