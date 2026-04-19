import { z } from "zod";
import { ProductCategory } from "../enums/app-enums";

export const productSchema = z.object({
  id: z.string(),
  barcode: z.string().min(8).max(32),
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.nativeEnum(ProductCategory),
  imageUrl: z.string().url().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const productUpsertSchema = productSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
});
