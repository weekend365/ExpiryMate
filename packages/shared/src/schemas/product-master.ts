import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import {
  BarcodeLookupSource,
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
});

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
});

export type ContributeBarcodeProductRequest = z.output<
  typeof contributeBarcodeProductSchema
>;
