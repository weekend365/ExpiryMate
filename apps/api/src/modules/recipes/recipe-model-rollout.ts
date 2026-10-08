import { createHash } from "node:crypto";
import type { RecipePreference, RecipeRecommendationRequest } from "@expirymate/shared";

export const DEFAULT_RECIPE_MODEL = "gpt-5.4-mini";
export const DEFAULT_RECIPE_CANDIDATE_PERCENT = 0;

export interface RecipeModelSelection {
  model: string;
  variant: "control" | "candidate";
  repairModel?: string;
}

export function selectRecipeModel(
  ownerKey: string,
  env: NodeJS.ProcessEnv = process.env,
  context?: { request: RecipeRecommendationRequest; preference: RecipePreference; inventoryCount: number },
): RecipeModelSelection {
  const controlModel = env.RECIPE_AI_MODEL?.trim() || DEFAULT_RECIPE_MODEL;
  const candidateModel = env.RECIPE_AI_CANDIDATE_MODEL?.trim();
  const candidatePercent = readRecipeCandidatePercent(
    env.RECIPE_AI_CANDIDATE_PERCENT,
  );

  if (!candidateModel || candidatePercent <= 0 || (context && !isSimpleRecipeRequest(context))) {
    return { model: controlModel, variant: "control" };
  }

  if (candidatePercent >= 100 || recipeModelBucket(ownerKey) < candidatePercent) {
    return { model: candidateModel, variant: "candidate",
      ...(env.RECIPE_AI_CANDIDATE_CONTROL_REPAIR?.trim().toLowerCase() === "true" ? { repairModel: controlModel } : {}) };
  }

  return { model: controlModel, variant: "control" };
}

/** Candidate quality must first be established on requests without safety constraints. */
export function isSimpleRecipeRequest(context: { request: RecipeRecommendationRequest; preference: RecipePreference; inventoryCount: number }) {
  const { request, preference, inventoryCount } = context;
  return preference.allergens.length === 0 && preference.excludedIngredients.length === 0 &&
    preference.dietaryStyle === "any" && preference.maxSpiceLevel === "any" &&
    preference.availableEquipment.includes("stovetop") && inventoryCount <= 12 &&
    request.servings <= 4 && request.maxCookingMinutes >= 15;
}

export function readRecipeCandidatePercent(value: string | undefined) {
  const parsed = Number(value ?? DEFAULT_RECIPE_CANDIDATE_PERCENT);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : DEFAULT_RECIPE_CANDIDATE_PERCENT;
}

function recipeModelBucket(ownerKey: string) {
  return (
    createHash("sha256")
      .update(`recipe-model-v1:${ownerKey}`)
      .digest()
      .readUInt32BE(0) % 100
  );
}
