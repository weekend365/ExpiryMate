import type { Query, QueryClient } from "@tanstack/react-query";

export const PERSISTED_QUERY_CACHE_KEY = "expirymate.query-cache.v1";
/** Bump when restored snapshots can strand first-screen gates (e.g. empty spaces). */
export const PERSISTED_QUERY_CACHE_BUSTER = "expirymate-mobile-v3-space-bootstrap";
export const PERSISTED_QUERY_MAX_AGE_MS = 1000 * 60 * 60 * 24;

const persistedQueryRoots = new Set([
  "dashboard-summary",
  "inventory-list",
  "inventory-spaces",
  "storage-locations",
]);

/**
 * Persist only user-scoped data that has rendered successfully at least once.
 * A background refetch error keeps its previous data, so that snapshot remains
 * eligible. Auth/privacy/notification queries and placeholder keys stay in memory.
 */
export function shouldPersistQuery(query: Query) {
  if (query.state.data === undefined) {
    return false;
  }

  // Empty spaces/inventory snapshots hide SpaceSwitcher and leave tab queries
  // disabled (isReady stays false). Never restore that dead-end state.
  if (Array.isArray(query.state.data) && query.state.data.length === 0) {
    return false;
  }

  const [root, ...scope] = query.queryKey;

  if (typeof root !== "string" || !persistedQueryRoots.has(root)) {
    return false;
  }

  return !scope.some(
    (part) => part === "signed-out" || part === "no-space" || part == null,
  );
}

export function isPersistedQueryRoot(queryKey: readonly unknown[]) {
  const root = queryKey[0];
  return typeof root === "string" && persistedQueryRoots.has(root);
}

export function invalidatePersistedQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => isPersistedQueryRoot(query.queryKey),
  });
}
