import { z } from "zod";

export const inventoryActivitySnapshotSchema = z.object({
  displayName: z.string(),
  quantityBase: z.number().int().nonnegative(),
  unitCode: z.string(),
  storageLocation: z.string(),
  expiryDate: z.string().nullable(),
  openedDate: z.string().nullable(),
  openedCheckDate: z.string().nullable(),
  status: z.string(),
});
export const inventoryActivitySchema = z.object({
  id: z.string(),
  inventoryItemId: z.string().nullable(),
  actorName: z.string(),
  action: z.enum(["created", "updated", "consumed", "discarded"]),
  before: inventoryActivitySnapshotSchema.nullable(),
  after: inventoryActivitySnapshotSchema,
  createdAt: z.string(),
});
export const inventoryActivityPageSchema = z.object({
  items: z.array(inventoryActivitySchema),
  nextCursor: z.string().nullable(),
});
export type InventoryActivity = z.infer<typeof inventoryActivitySchema>;
export type InventoryActivitySnapshot = z.infer<
  typeof inventoryActivitySnapshotSchema
>;
