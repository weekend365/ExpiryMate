import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  toKstDateOnly,
  type InventoryActivity,
  type InventoryActivitySnapshot,
} from "@expirymate/shared";

type ActivityItem = Omit<
  InventoryActivitySnapshot,
  "expiryDate" | "openedDate" | "openedCheckDate"
> & {
  id: string;
  spaceId?: string | null;
  expiryDate: string | Date | null;
  openedDate?: string | Date | null;
  openedCheckDate?: string | Date | null;
};
const dateOnly = (value: string | Date | null | undefined) =>
  value ? toKstDateOnly(value) : null;
export function activitySnapshot(
  item: ActivityItem,
): InventoryActivitySnapshot {
  return {
    displayName: item.displayName,
    quantityBase: item.quantityBase,
    unitCode: item.unitCode,
    storageLocation: item.storageLocation,
    expiryDate: dateOnly(item.expiryDate),
    openedDate: dateOnly(item.openedDate),
    openedCheckDate: dateOnly(item.openedCheckDate),
    status: item.status,
  };
}
export async function recordInventoryActivity(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  action: InventoryActivity["action"],
  after: ActivityItem,
  before?: ActivityItem,
) {
  if (!after.spaceId)
    throw new BadRequestException("냉장고를 먼저 골라 주세요.");
  await tx.inventoryActivity.create({
    data: {
      spaceId: after.spaceId,
      inventoryItemId: after.id,
      actorUserId,
      action,
      ...(before ? { before: activitySnapshot(before) } : {}),
      after: activitySnapshot(after),
    },
  });
}
