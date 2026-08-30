import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";

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
