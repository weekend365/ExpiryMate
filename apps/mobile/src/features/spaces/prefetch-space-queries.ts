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

type SpaceScopedPrefetch = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
};

/**
 * Kick off first-screen space-scoped fetches as soon as an active space is known.
 * Uses `fetchQuery` (not prefetch) so a cold start always hits the network even
 * when a restored cache entry looks fresh, and so failures land in the cache for
 * screen-level retry instead of being swallowed.
 */
export function prefetchActiveSpaceQueries(
  queryClient: QueryClient,
  sessionUserId: string,
  activeSpaceId: string,
) {
  const targets: SpaceScopedPrefetch[] = [
    {
      queryKey: withInventorySpace(
        sessionQueryKeys.dashboard,
        sessionUserId,
        activeSpaceId,
      ),
      queryFn: () => getDashboardSummary(activeSpaceId),
    },
    {
      queryKey: withInventorySpace(
        sessionQueryKeys.inventory,
        sessionUserId,
        activeSpaceId,
      ),
      queryFn: () => listAllInventory(activeSpaceId),
    },
    {
      queryKey: withInventorySpace(
        sessionQueryKeys.recipes,
        sessionUserId,
        activeSpaceId,
      ),
      queryFn: () => listRecipeRecommendations(activeSpaceId),
    },
    {
      queryKey: withInventorySpace(
        sessionQueryKeys.storageLocations,
        sessionUserId,
        activeSpaceId,
      ),
      queryFn: () => listStorageLocations(activeSpaceId),
    },
  ];

  return Promise.all(
    targets.map(({ queryKey, queryFn }) =>
      queryClient
        .fetchQuery({
          queryKey,
          queryFn,
          // Force a network pass on space hydration; restored snapshots can look
          // "fresh" within the global staleTime and skip prefetch otherwise.
          staleTime: 0,
        })
        .catch(() => undefined),
    ),
  );
}

/** Nudge already-mounted observers that missed the enabled→fetch transition. */
export function refetchActiveSpaceQueries(
  queryClient: QueryClient,
  sessionUserId: string,
  activeSpaceId: string,
) {
  const roots = [
    sessionQueryKeys.dashboard,
    sessionQueryKeys.inventory,
    sessionQueryKeys.recipes,
    sessionQueryKeys.storageLocations,
  ] as const;

  return Promise.all(
    roots.map((root) =>
      queryClient.refetchQueries({
        queryKey: withInventorySpace(root, sessionUserId, activeSpaceId),
        type: "active",
      }),
    ),
  );
}
