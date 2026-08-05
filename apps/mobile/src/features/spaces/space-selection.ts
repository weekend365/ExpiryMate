import type { InventorySpaceSummary } from "@expirymate/shared";

export type ChooseActiveSpaceOptions = {
  /**
   * When the requested id is absent from `spaces`, fall back to personal/first.
   * Pass false while the spaces list may still be incomplete (fetching/refetching)
   * so we do not overwrite a shared-fridge selection with the personal fridge.
   */
  allowFallbackWhenMissing?: boolean;
};

export function chooseActiveInventorySpace(
  spaces: InventorySpaceSummary[],
  requestedSpaceId: string | null | undefined,
  options?: ChooseActiveSpaceOptions,
) {
  if (requestedSpaceId) {
    const match = spaces.find((space) => space.id === requestedSpaceId);
    if (match) {
      return match;
    }
    if (options?.allowFallbackWhenMissing === false) {
      return null;
    }
  }

  return (
    spaces.find((space) => space.type === "personal") ??
    spaces[0] ??
    null
  );
}
