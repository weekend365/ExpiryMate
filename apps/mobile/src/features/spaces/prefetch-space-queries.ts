import type { QueryClient } from "@tanstack/react-query";
import {
  getDashboardSummary,
  listAllInventory,
  listRecipeRecommendations,
  listStorageLocations,
} from "../../services/api";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";

/**
 * Kick off first-screen space-scoped fetches as soon as an active space is known.
 * Screen hooks stay gated on the same keys; this avoids empty first paint when a
 * tab mounts after `enabled` flipped while observers were absent, or when a
 * disabled query ignored invalidate/refetch during auth/space hydration.
 */
export function prefetchActiveSpaceQueries(
  queryClient: QueryClient,
  sessionUserId: string,
  activeSpaceId: string,
) {
  const dashboardKey = withInventorySpace(
    sessionQueryKeys.dashboard,
    sessionUserId,
    activeSpaceId,
  );
  const inventoryKey = withInventorySpace(
    sessionQueryKeys.inventory,
    sessionUserId,
    activeSpaceId,
  );
  const recipesKey = withInventorySpace(
    sessionQueryKeys.recipes,
    sessionUserId,
    activeSpaceId,
  );
  const storageKey = withInventorySpace(
    sessionQueryKeys.storageLocations,
    sessionUserId,
    activeSpaceId,
  );

  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: dashboardKey,
      queryFn: () => getDashboardSummary(activeSpaceId),
    }),
    queryClient.prefetchQuery({
      queryKey: inventoryKey,
      queryFn: () => listAllInventory(activeSpaceId),
    }),
    queryClient.prefetchQuery({
      queryKey: recipesKey,
      queryFn: () => listRecipeRecommendations(activeSpaceId),
    }),
    queryClient.prefetchQuery({
      queryKey: storageKey,
      queryFn: () => listStorageLocations(activeSpaceId),
    }),
  ]);
}
