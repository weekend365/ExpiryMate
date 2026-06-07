import { z } from "zod";

export const privacyStatusSchema = z.object({
  privacyPolicyUrl: z.string(),
  privacyChoicesUrl: z.string(),
  contactEmail: z.string(),
  aiDataNoticeVersion: z.string(),
  aiDataNoticeAcceptedAt: z.string().nullable(),
  hasAcceptedCurrentAiDataNotice: z.boolean(),
});

export const acceptAiDataNoticeResponseSchema = z.object({
  ok: z.literal(true),
  status: privacyStatusSchema,
});

export const deleteAccountRequestSchema = z.object({
  confirmation: z.literal("삭제"),
});

export const deleteAccountResponseSchema = z.object({
  ok: z.literal(true),
  deletedAt: z.string(),
});
