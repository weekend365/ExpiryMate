import type { InventorySpaceSummary } from "@expirymate/shared";

export function chooseActiveInventorySpace(
  spaces: InventorySpaceSummary[],
  requestedSpaceId: string | null | undefined,
) {
  return (
    spaces.find((space) => space.id === requestedSpaceId) ??
    spaces.find((space) => space.type === "personal") ??
    spaces[0] ??
    null
  );
}
