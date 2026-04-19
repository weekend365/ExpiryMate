import { z } from "zod";
import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
} from "../enums/app-enums";

export const inventoryItemSchema = z.object({
  id: z.string(),
  productId: z.string().nullable().optional(),
  ownerKey: z.string().optional(),
  barcode: z.string().nullable().optional(),
  displayName: z.string().min(1),
  brand: z.string().nullable().optional(),
  category: z.nativeEnum(ProductCategory).nullable().optional(),
  quantity: z.number().positive(),
  unit: z.string().nullable().optional(),
  storageLocation: z.nativeEnum(StorageLocation),
  expiryDate: z.string().min(1),
  expirySource: z.nativeEnum(ExpirySource),
  status: z.nativeEnum(ItemStatus),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const inventoryUpsertSchema = inventoryItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const inventoryFormSchema = z.object({
  productId: z.string().optional(),
  barcode: z.string().min(8, "바코드를 확인해주세요").max(32).optional().or(z.literal("")),
  displayName: z.string().min(1, "상품명을 입력해주세요"),
  brand: z.string().optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  quantity: z.coerce.number().min(1, "수량은 1 이상이어야 해요"),
  unit: z.string().min(1).optional(),
  storageLocation: z.nativeEnum(StorageLocation),
  expiryDate: z.string().min(1, "유통기한을 입력해주세요"),
  expirySource: z.nativeEnum(ExpirySource),
  notes: z.string().optional(),
});
