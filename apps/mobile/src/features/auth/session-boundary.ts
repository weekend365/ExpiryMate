import type { QueryClient } from "@tanstack/react-query";
import { clearRecipeGenerationState } from "../recipes/recipe-generation-reset";
import { useRegistrationStore } from "../../store/registration-store";

/**
 * Wipe user-scoped client state so A→logout→B never paints A's cache/drafts.
 * Call after tokens are cleared (or immediately on logout success).
 */
export function clearUserScopedClientState(queryClient: QueryClient) {
  queryClient.clear();
  useRegistrationStore.getState().clearDraft();
  useRegistrationStore.getState().clearPrefill();
  clearRecipeGenerationState();
}

/** Prefix-stable keys; append userId at the call site for session isolation. */
export const sessionQueryKeys = {
  auth: ["auth", "me"] as const,
  dashboard: ["dashboard-summary"] as const,
  inventory: ["inventory-list"] as const,
  recipes: ["recipe-recommendations"] as const,
  recipeFavorites: ["recipe-favorites"] as const,
  notificationPreferences: ["notification-preferences"] as const,
  storageLocations: ["storage-locations"] as const,
  subscription: ["subscription-entitlement"] as const,
  privacy: ["privacy-status"] as const,
};

export function withSessionUser(
  key: readonly string[],
  userId: string | undefined,
) {
  return [...key, userId ?? "signed-out"] as const;
}
