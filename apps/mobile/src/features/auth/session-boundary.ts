import type { QueryClient } from "@tanstack/react-query";
import { clearRecipeGenerationState } from "../recipes/recipe-generation-reset";
import { clearPersistedQueryCache } from "../../services/query-client";
import { useRegistrationStore } from "../../store/registration-store";
import { clearRecipePreferenceNavigationState } from "../settings/recipe-preference-navigation";

/**
 * Wipe user-scoped client state so A→logout→B never paints A's cache/drafts.
 * Keep the auth query object itself alive: mounted useAuth observers remain
 * attached to that exact object and would otherwise miss the next setQueryData,
 * leaving an old or permanently-pending session result on screen.
 * Call after tokens are cleared (or immediately on logout success).
 */
export function clearUserScopedClientState(queryClient: QueryClient) {
  // Cancellation is synchronous inside TanStack Query even though the public
  // method returns a Promise. This prevents an older getMe request from
  // overwriting the session value that the caller seeds immediately after.
  void queryClient.cancelQueries(
    { queryKey: sessionQueryKeys.auth, exact: true },
    { silent: true },
  );
  queryClient.removeQueries({
    predicate: (query) => !isAuthSessionQuery(query.queryKey),
  });
  queryClient.getMutationCache().clear();
  void Promise.resolve(clearPersistedQueryCache()).catch(() => undefined);
  useRegistrationStore.getState().clearDraft();
  useRegistrationStore.getState().clearPrefill();
  useRegistrationStore.getState().clearLastStorageLocation();
  useRegistrationStore.getState().clearPreferredEntryMethod();
  useRegistrationStore.getState().clearPhotoDraft();
  clearRecipeGenerationState();
  clearRecipePreferenceNavigationState();
  void import("../recipes/cooking-timer")
    .then(({ clearPersistedCookingTimer }) => clearPersistedCookingTimer())
    .catch(() => undefined);
}

/**
 * Terminal API refresh failures happen outside React Query's auth query. Clear
 * every user-scoped cache and seed an explicit signed-out auth result so the
 * mounted redirect gate moves to login without waiting for an app restart.
 */
export function handleAuthSessionCleared(queryClient: QueryClient) {
  clearUserScopedClientState(queryClient);
  queryClient.setQueryData(sessionQueryKeys.auth, null);
}

function isAuthSessionQuery(queryKey: readonly unknown[]) {
  return (
    queryKey.length === sessionQueryKeys.auth.length &&
    queryKey.every((part, index) => part === sessionQueryKeys.auth[index])
  );
}

/** Prefix-stable keys; append userId at the call site for session isolation. */
export const sessionQueryKeys = {
  auth: ["auth", "me"] as const,
  dashboard: ["dashboard-summary"] as const,
  inventory: ["inventory-list"] as const,
  inventoryItem: ["inventory-item"] as const,
  recipes: ["recipe-recommendations"] as const,
  recipeFavorites: ["recipe-favorites"] as const,
  recipePreferences: ["recipe-preferences"] as const,
  notificationPreferences: ["notification-preferences"] as const,
  storageLocations: ["storage-locations"] as const,
  subscription: ["subscription-entitlement"] as const,
  monetization: ["monetization-status"] as const,
  affiliateShopping: ["affiliate-shopping"] as const,
  affiliateReorderPreview: ["affiliate-reorder-preview"] as const,
  photoParseAccess: ["inventory-photo-parse-access"] as const,
  privacy: ["privacy-status"] as const,
  spaces: ["inventory-spaces"] as const,
};

export function withSessionUser(
  key: readonly string[],
  userId: string | undefined,
) {
  return [...key, userId ?? "signed-out"] as const;
}

export function withInventorySpace(
  key: readonly string[],
  userId: string | undefined,
  spaceId: string | undefined,
) {
  return [
    ...key,
    userId ?? "signed-out",
    spaceId ?? "no-space",
  ] as const;
}

export function spacesListQueryKey(userId: string | undefined) {
  return withSessionUser(sessionQueryKeys.spaces, userId);
}
