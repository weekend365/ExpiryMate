import { z } from "zod";
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

export const contributeBarcodeProductSchema = z.object({
  barcode: z.string().min(8).max(18),
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
});
