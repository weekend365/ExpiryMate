let resetHandler: (() => void) | null = null;
let acknowledgeHandler: (() => void) | null = null;

/** Wired by RecipeGenerationProvider so logout can clear in-memory recipe state. */
export function registerRecipeGenerationReset(handler: (() => void) | null) {
  resetHandler = handler;
}

/** Wired by RecipeGenerationProvider so push/home can dismiss banners without clearing results. */
export function registerRecipeGenerationAcknowledge(
  handler: (() => void) | null,
) {
  acknowledgeHandler = handler;
}

export function clearRecipeGenerationState() {
  resetHandler?.();
}

/** Dismiss success/error generation banners while keeping the latest recommendation. */
export function acknowledgeRecipeGenerationState() {
  acknowledgeHandler?.();
}
