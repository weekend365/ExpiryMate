import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  UnitCode,
} from "../enums/app-enums";
import { DATE_ONLY_PATTERN, isDateOnlyString } from "../utils/date";

const dateOnlySchema = z
  .string()
  .min(1, "유통기한을 입력해주세요")
  .regex(DATE_ONLY_PATTERN, "날짜는 YYYY-MM-DD 형식이어야 해요")
  .refine(isDateOnlyString, "올바른 날짜를 입력해주세요");

/** Empty / whitespace-only strings become omitted optionals. */
const optionalText = (max: number, message?: string) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(max, message).optional());

/** Storage location key (system or owner custom). Server validates ownership. */
export const storageLocationKeySchema = z
  .string()
  .trim()
  .min(1, "보관 위치를 골라 주세요")
  .max(
    fieldLimits.storageLocationKey,
    `보관 위치 키는 ${fieldLimits.storageLocationKey}자까지예요`,
  );

export const inventoryItemSchema = z.object({
  id: z.string(),
  productId: z.string().nullable().optional(),
  ownerKey: z.string().optional(),
  spaceId: z.string().nullable().optional(),
  createdByUserId: z.string().nullable().optional(),
  updatedByUserId: z.string().nullable().optional(),
  version: z.number().int().positive().default(1),
  displayName: z.string().min(1).max(fieldLimits.displayName),
  brand: z.string().max(fieldLimits.brand).nullable().optional(),
  category: z.nativeEnum(ProductCategory).nullable().optional(),
  quantity: z.number().positive(),
  unit: z.string().max(fieldLimits.unit).nullable().optional(),
  quantityBase: z.number().int().min(0),
  unitCode: z.nativeEnum(UnitCode),
  storageLocation: storageLocationKeySchema,
  expiryDate: dateOnlySchema,
  expirySource: z.nativeEnum(ExpirySource),
  status: z.nativeEnum(ItemStatus),
  notes: z.string().max(fieldLimits.notes).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const inventoryUpsertSchema = inventoryItemSchema.omit({
  id: true,
  ownerKey: true,
  spaceId: true,
  createdByUserId: true,
  updatedByUserId: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

/** Mobile form + API create body (without server-owned status default). */
export const inventoryFormSchema = z.object({
  productId: optionalText(fieldLimits.productId),
  displayName: z
    .string()
    .trim()
    .min(1, "상품명을 입력해주세요")
    .max(fieldLimits.displayName, `상품명은 ${fieldLimits.displayName}자까지예요`),
  brand: optionalText(
    fieldLimits.brand,
    `브랜드는 ${fieldLimits.brand}자까지예요`,
  ),
  category: z.nativeEnum(ProductCategory).optional(),
  quantity: z.coerce.number().int().min(1, "수량은 1 이상이어야 해요"),
  unit: optionalText(fieldLimits.unit),
  quantityBase: z.coerce.number().int().min(1).optional(),
  unitCode: z.nativeEnum(UnitCode).optional(),
  storageLocation: storageLocationKeySchema,
  expiryDate: dateOnlySchema,
  expirySource: z.nativeEnum(ExpirySource),
  notes: optionalText(
    fieldLimits.notes,
    `메모는 ${fieldLimits.notes}자까지예요`,
  ),
});

/** API create body — same as form, plus optional status override. */
export const createInventoryItemBodySchema = inventoryFormSchema.extend({
  status: z.nativeEnum(ItemStatus).optional(),
});

export const updateInventoryItemBodySchema =
  createInventoryItemBodySchema.partial().extend({
    expectedVersion: z.number().int().positive().optional(),
  });

export const batchConsumeInventoryItemSchema = z.object({
  inventoryItemId: z.string().trim().min(1),
  amountBase: z.coerce
    .number()
    .int()
    .min(1, "사용량은 1 이상이어야 해요"),
});

export const batchConsumeInventoryItemsBodySchema = z.object({
  items: z
    .array(batchConsumeInventoryItemSchema)
    .min(1, "사용할 재료를 하나 이상 골라 주세요")
    .max(100, "한 번에 최대 100개까지 반영할 수 있어요")
    .superRefine((items, context) => {
      const seen = new Set<string>();

      items.forEach((item, index) => {
        if (seen.has(item.inventoryItemId)) {
          context.addIssue({
            code: "custom",
            message: "같은 재료는 한 번만 반영할 수 있어요",
            path: [index, "inventoryItemId"],
          });
        }
        seen.add(item.inventoryItemId);
      });
    }),
});

export const batchConsumeInventoryItemsResponseSchema = z.object({
  count: z.number().int().min(0),
  items: z.array(inventoryItemSchema),
});

export type InventoryFormValues = z.output<typeof inventoryFormSchema>;
export type InventoryFormInput = z.input<typeof inventoryFormSchema>;
export type CreateInventoryItemBody = z.output<typeof createInventoryItemBodySchema>;
export type UpdateInventoryItemBody = z.output<typeof updateInventoryItemBodySchema>;
export type BatchConsumeInventoryItem = z.output<
  typeof batchConsumeInventoryItemSchema
>;
export type BatchConsumeInventoryItemsBody = z.output<
  typeof batchConsumeInventoryItemsBodySchema
>;
export type BatchConsumeInventoryItemsResponse = z.output<
  typeof batchConsumeInventoryItemsResponseSchema
>;
