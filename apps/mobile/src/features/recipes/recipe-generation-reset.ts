let resetHandler: (() => void) | null = null;

/** Wired by RecipeGenerationProvider so logout can clear in-memory recipe state. */
export function registerRecipeGenerationReset(handler: (() => void) | null) {
  resetHandler = handler;
}

export function clearRecipeGenerationState() {
  resetHandler?.();
}
