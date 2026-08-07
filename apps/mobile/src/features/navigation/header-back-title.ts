type NavigationRouteLike = {
  name?: string;
  state?: {
    index?: number;
    routes?: NavigationRouteLike[];
  } | null;
};

const BACK_TITLE = "뒤로가기";

/**
 * Consistent back label for a tab route name.
 * Used so iOS never shows the Expo group id `(tabs)`.
 */
export function resolveTabHeaderBackTitle(tabName?: string | null): string {
  void tabName;
  return BACK_TITLE;
}

/**
 * Builds a back label from the previous stack route.
 * Every stack origin uses the same wording.
 */
export function resolveHeaderBackTitle(
  previousRoute?: NavigationRouteLike | null,
): string {
  void previousRoute;
  return BACK_TITLE;
}
