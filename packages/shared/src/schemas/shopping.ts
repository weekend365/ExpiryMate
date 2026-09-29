import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const shoppingItemFields = {
  name: z
    .string()
    .trim()
    .min(1, "살 재료를 입력해 주세요")
    .max(fieldLimits.displayName),
  quantity: z.number().int().min(1, "수량은 1 이상이어야 해요").max(9999),
  unit: z.string().trim().min(1, "단위를 입력해 주세요").max(fieldLimits.unit),
};
export const createShoppingItemSchema = z.object(shoppingItemFields);
export const updateShoppingItemSchema = z
  .object({
    ...shoppingItemFields,
    completed: z.boolean(),
  })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const shoppingItemSchema = z.object({
  ...shoppingItemFields,
  id: z.string(),
  spaceId: z.string(),
  version: z.number().int().positive(),
  completedAt: z.string().nullable(),
  inventoryItemId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const shoppingListSchema = z.object({
  items: z.array(shoppingItemSchema),
});
export type CreateShoppingItem = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItem = z.infer<typeof updateShoppingItemSchema>;
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type ShoppingList = z.infer<typeof shoppingListSchema>;

export function normalizeShoppingName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
}
