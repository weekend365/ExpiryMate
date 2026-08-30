export type RecipePreferenceRouteSource = "recommendations";

let hasPendingRecommendationSaveNotice = false;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRecipePreferenceRouteSource(
  value: string | string[] | undefined,
): RecipePreferenceRouteSource | null {
  return firstParam(value) === "recommendations" ? "recommendations" : null;
}

export function recipePreferenceRoute(
  source?: RecipePreferenceRouteSource,
) {
  if (!source) {
    return "/settings/recipe-preferences" as const;
  }

  return {
    pathname: "/settings/recipe-preferences" as const,
    params: { from: source },
  };
}

export function markRecipePreferenceSavedFromRecommendations() {
  hasPendingRecommendationSaveNotice = true;
}

export function consumeRecipePreferenceSavedFromRecommendations() {
  const pending = hasPendingRecommendationSaveNotice;
  hasPendingRecommendationSaveNotice = false;
  return pending;
}

export function clearRecipePreferenceNavigationState() {
  hasPendingRecommendationSaveNotice = false;
}
