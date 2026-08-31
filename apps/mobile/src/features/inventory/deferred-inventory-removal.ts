import {
  formatBaseQuantity,
  formatDateKoreanCompact,
  type InventoryItem,
} from "@expirymate/shared";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";

export type InventoryRemovalAction = "consume" | "discard";

export type InventoryRemovalEntry = {
  action: InventoryRemovalAction;
  item: InventoryItem;
  amountBase: number;
};

export type CommittedInventoryRemoval = {
  entries: InventoryRemovalEntry[];
  spaceId: string;
};

export function getCommittedFullConsumeTarget(
  removal: CommittedInventoryRemoval | null,
) {
  if (!removal || removal.entries.length !== 1) {
    return null;
  }

  const [entry] = removal.entries;

  return entry?.action === "consume" &&
    entry.amountBase >= entry.item.quantityBase
    ? entry.item
    : null;
}

export function buildInventoryUndoLabel(entries: InventoryRemovalEntry[]) {
  if (entries.length === 1) {
    const [{ action, item, amountBase }] = entries;
    if (action === "consume" && amountBase < item.quantityBase) {
      return `${item.displayName} ${formatBaseQuantity(amountBase, item.unitCode)}를 빼 뒀어요`;
    }

    if (action === "discard") {
      return `${item.displayName}을(를) 폐기했어요`;
    }

    const itemLabel = item.expiryDate
      ? `${formatDateKoreanCompact(item.expiryDate)}까지인 ${item.displayName}`
      : `기한을 확인할 ${item.displayName}`;

    return `${itemLabel}을(를) 보관함에서 빼 뒀어요`;
  }

  if (entries.every((entry) => entry.action === "discard")) {
    return `${entries.length}개 재료를 폐기했어요`;
  }

  return `${entries.length}개 재료를 정리했어요`;
}

export function isPendingForDifferentSpace(
  pendingSpaceId: string | undefined,
  activeSpaceId: string | undefined,
) {
  return Boolean(pendingSpaceId && pendingSpaceId !== activeSpaceId);
}

export function inventoryRemovalQueryKeys(
  sessionUserId: string | undefined,
  spaceId: string | undefined,
) {
  return {
    inventory: withInventorySpace(
      sessionQueryKeys.inventory,
      sessionUserId,
      spaceId,
    ),
    dashboard: withInventorySpace(
      sessionQueryKeys.dashboard,
      sessionUserId,
      spaceId,
    ),
    shopping: withInventorySpace(
      sessionQueryKeys.affiliateShopping,
      sessionUserId,
      spaceId,
    ),
    reorderPreview: withInventorySpace(
      sessionQueryKeys.affiliateReorderPreview,
      sessionUserId,
      spaceId,
    ),
  };
}
