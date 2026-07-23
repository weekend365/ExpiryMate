import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import {
  SupportInquiryCategory,
  SupportInquiryStatus,
} from "../enums/app-enums";

export const supportInquiryCategorySchema = z.nativeEnum(
  SupportInquiryCategory,
);

export const supportInquiryStatusSchema = z.nativeEnum(SupportInquiryStatus);

export const supportInquiryCreateSchema = z.object({
  category: supportInquiryCategorySchema,
  body: z
    .string()
    .trim()
    .min(fieldLimits.supportInquiryBody.min, {
      message: "조금만 더 자세히 알려 주시면 도움이 돼요.",
    })
    .max(fieldLimits.supportInquiryBody.max, {
      message: "내용은 조금 짧게 줄여 주실 수 있을까요?",
    }),
  appVersion: z
    .string()
    .trim()
    .max(fieldLimits.appVersion)
    .optional()
    .nullable(),
  platform: z.enum(["ios", "android", "web", "unknown"]).optional().nullable(),
});

export const supportInquiryCloseSchema = z.object({
  status: z.literal(SupportInquiryStatus.CLOSED),
});

export const supportInquirySchema = z.object({
  id: z.string(),
  userId: z.string(),
  userEmail: z.string().nullable().optional(),
  userDisplayName: z.string().nullable().optional(),
  category: supportInquiryCategorySchema,
  body: z.string(),
  appVersion: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  status: supportInquiryStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const supportInquiryListResponseSchema = z.object({
  items: z.array(supportInquirySchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type SupportInquiryCreateInput = z.infer<
  typeof supportInquiryCreateSchema
>;
export type SupportInquiryCloseInput = z.infer<
  typeof supportInquiryCloseSchema
>;
export type SupportInquiry = z.infer<typeof supportInquirySchema>;
export type SupportInquiryListResponse = z.infer<
  typeof supportInquiryListResponseSchema
>;
