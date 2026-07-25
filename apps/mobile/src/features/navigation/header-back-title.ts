type NavigationRouteLike = {
  name?: string;
  state?: {
    index?: number;
    routes?: NavigationRouteLike[];
  } | null;
};

const TAB_BACK_TITLES: Record<string, string> = {
  home: "홈",
  inventory: "보관함",
  recommendations: "추천",
  settings: "설정",
};

const FALLBACK_BACK_TITLE = "뒤로";
const DEFAULT_TAB_BACK_TITLE = TAB_BACK_TITLES.home;

/**
 * Conversational back label for a tab route name.
 * Used so iOS never shows the Expo group id `(tabs)`.
 */
export function resolveTabHeaderBackTitle(tabName?: string | null): string {
  if (!tabName) {
    return DEFAULT_TAB_BACK_TITLE;
  }

  return TAB_BACK_TITLES[tabName] ?? DEFAULT_TAB_BACK_TITLE;
}

/**
 * Builds a back label from the previous stack route.
 * Tab origins use the active tab; other stack screens fall back to "뒤로"
 * because their `title` options already feed the native back button.
 */
export function resolveHeaderBackTitle(
  previousRoute?: NavigationRouteLike | null,
): string {
  if (!previousRoute?.name) {
    return FALLBACK_BACK_TITLE;
  }

  if (previousRoute.name === "(tabs)") {
    const tabState = previousRoute.state;
    const tabRoute = tabState?.routes?.[tabState.index ?? 0];
    return resolveTabHeaderBackTitle(tabRoute?.name);
  }

  return FALLBACK_BACK_TITLE;
}
