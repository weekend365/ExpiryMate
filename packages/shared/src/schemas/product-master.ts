import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import {
  BarcodeLookupSource,
  ProductMasterCorrectionStatus,
  ProductMasterSource,
} from "../enums/app-enums";

export const productMasterSchema = z.object({
  id: z.string(),
  barcode: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  source: z.nativeEnum(ProductMasterSource),
  contributedByUserId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const barcodeLookupResultSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  source: z.nativeEnum(BarcodeLookupSource),
  productMasterId: z.string().nullable(),
  contributionToken: z.string().optional(),
});

export const barcodeRewardReasonSchema = z.enum([
  "granted",
  "existing_barcode",
  "invalid_gtin",
  "lookup_unverified",
  "insufficient_product_data",
  "daily_limit_reached",
  "balance_limit_reached",
  "rewards_disabled",
]);

const optionalContributeText = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(max).optional());

export const contributeBarcodeProductSchema = z.object({
  barcode: z
    .string()
    .regex(/^\d{8,18}$/, "바코드는 8~18자리 숫자여야 해요"),
  name: z.string().trim().min(1).max(fieldLimits.displayName),
  brand: optionalContributeText(fieldLimits.brand),
  category: optionalContributeText(fieldLimits.brand),
  contributionToken: z.string().max(2048).optional(),
});

export const productMasterCorrectionSchema = z.object({
  id: z.string(),
  productMasterId: z.string(),
  submittedByUserId: z.string().nullable().optional(),
  catalogName: z.string(),
  catalogBrand: z.string(),
  catalogCategory: z.string(),
  proposedName: z.string(),
  proposedBrand: z.string().nullable().optional(),
  proposedCategory: z.string().nullable().optional(),
  status: z.nativeEnum(ProductMasterCorrectionStatus),
  reviewedByUserId: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminProductMasterListItemSchema = productMasterSchema.extend({
  pendingCorrectionCount: z.number().int().min(0),
});

export const adminProductMasterListResponseSchema = z.object({
  items: z.array(adminProductMasterListItemSchema),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalCount: z.number().int().min(0),
  hasMore: z.boolean(),
});

export const adminProductMasterDetailSchema = z.object({
  product: productMasterSchema,
  corrections: z.array(productMasterCorrectionSchema),
});

export const updateProductMasterBodySchema = z
  .object({
    name: z.string().trim().min(1).max(fieldLimits.displayName).optional(),
    brand: optionalContributeText(fieldLimits.brand),
    category: optionalContributeText(fieldLimits.brand),
    imageUrl: z
      .union([z.string().url(), z.literal(""), z.null()])
      .optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.brand !== undefined ||
      value.category !== undefined ||
      value.imageUrl !== undefined,
    "바꿀 내용을 알려 주세요.",
  );

export type ContributeBarcodeProductRequest = z.output<
  typeof contributeBarcodeProductSchema
>;
export type BarcodeRewardReason = z.infer<typeof barcodeRewardReasonSchema>;
export type ProductMasterCorrection = z.infer<
  typeof productMasterCorrectionSchema
>;
export type AdminProductMasterListItem = z.infer<
  typeof adminProductMasterListItemSchema
>;
export type AdminProductMasterListResponse = z.infer<
  typeof adminProductMasterListResponseSchema
>;
export type AdminProductMasterDetail = z.infer<
  typeof adminProductMasterDetailSchema
>;
export type UpdateProductMasterBody = z.output<
  typeof updateProductMasterBodySchema
>;
