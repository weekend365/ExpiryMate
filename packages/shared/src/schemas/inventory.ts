import { z } from "zod";
import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
} from "../enums/app-enums";
import { DATE_ONLY_PATTERN, isDateOnlyString } from "../utils/date";

const dateOnlySchema = z
  .string()
  .min(1, "유통기한을 입력해주세요")
  .regex(DATE_ONLY_PATTERN, "날짜는 YYYY-MM-DD 형식이어야 해요")
  .refine(isDateOnlyString, "올바른 날짜를 입력해주세요");

export const inventoryItemSchema = z.object({
  id: z.string(),
  productId: z.string().nullable().optional(),
  ownerKey: z.string().optional(),
  displayName: z.string().min(1),
  brand: z.string().nullable().optional(),
  category: z.nativeEnum(ProductCategory).nullable().optional(),
  quantity: z.number().positive(),
  unit: z.string().nullable().optional(),
  storageLocation: z.nativeEnum(StorageLocation),
  expiryDate: dateOnlySchema,
  expirySource: z.nativeEnum(ExpirySource),
  status: z.nativeEnum(ItemStatus),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const inventoryUpsertSchema = inventoryItemSchema.omit({
  id: true,
  ownerKey: true,
  createdAt: true,
  updatedAt: true,
});

export const inventoryFormSchema = z.object({
  productId: z.string().optional(),
  displayName: z.string().min(1, "상품명을 입력해주세요"),
  brand: z.string().optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  quantity: z.coerce.number().min(1, "수량은 1 이상이어야 해요"),
  unit: z.string().min(1).optional(),
  storageLocation: z.nativeEnum(StorageLocation),
  expiryDate: dateOnlySchema,
  expirySource: z.nativeEnum(ExpirySource),
  notes: z.string().optional(),
});
