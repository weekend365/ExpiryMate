/* global window, URLSearchParams */
// Synthetic fixtures only. No server, account, analytics, or persistence calls.
const state = new URLSearchParams(window.location.search).get("state") || "calm";
const space = { id: "review-space", name: "내 냉장고", type: "personal", role: "owner" };
const noop = () => {};
const refetch = async () => {};
const counts = state === "expired" ? [1, 1, 5, 4]
  : state === "warning" ? [0, 0, 5, 4]
  : state === "empty" ? [0, 0, 0, 0] : [0, 0, 0, 4];
const [unknownExpiryCount, expiredCount, within7DaysCount, safeCount] = counts;

export function useDashboardSummary() {
  return {
    data: ["loading", "error"].includes(state) ? undefined : {
      unknownExpiryCount, expiredCount, within7DaysCount, safeCount,
      totalActiveCount: counts.reduce((total, count) => total + count, 0),
      expiringItems: [], latestRecommendationPreview: null,
    },
    isLoading: state === "loading", isError: state === "error", error: null,
    isRefetching: false, refetch,
  };
}
export function useRecipeGeneration() {
  return { status: ["pending", "success"].includes(state) ? state : "idle", errorMessage: null, acknowledgeRecipeGeneration: noop };
}
export function useActiveSpace() {
  return { spaces: [space], activeSpace: space, activeSpaceId: space.id, isLoading: false, error: null, refetchSpaces: refetch, setActiveSpaceId: noop };
}
export function useAuth() { return { sessionUserId: null }; }
export const sessionQueryKeys = { dashboard: ["review-dashboard"], inventory: ["review-inventory"], recipes: ["review-recipes"] };
export const withInventorySpace = (key, user, spaceId) => [...key, user, spaceId];
export function useInsightsPreview() { return { data: { ready: false }, refetch }; }
export function useSubscriptionEntitlement() { return { query: { data: { hasActiveEntitlement: false } } }; }
export function useAffiliateReorderPreview() { return { data: { enabled: false, group: null } }; }
export function useRegistrationStore(selector) { return selector({ clearPrefill: noop }); }
export function isInventoryPhotoParseEnabled() { return false; }
export function PendingCookingCleanupCard() { return null; }
export function HomeReorderCard() { return null; }
export function IngredientEntryMethodSheet() { return null; }
export function BottomSheet() { return null; }
