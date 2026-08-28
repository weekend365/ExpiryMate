import { createHash } from "node:crypto";

export const DEFAULT_RECIPE_MODEL = "gpt-5.4-mini";
export const DEFAULT_RECIPE_CANDIDATE_PERCENT = 0;

export interface RecipeModelSelection {
  model: string;
  variant: "control" | "candidate";
}

export function selectRecipeModel(
  ownerKey: string,
  env: NodeJS.ProcessEnv = process.env,
): RecipeModelSelection {
  const controlModel = env.RECIPE_AI_MODEL?.trim() || DEFAULT_RECIPE_MODEL;
  const candidateModel = env.RECIPE_AI_CANDIDATE_MODEL?.trim();
  const candidatePercent = readRecipeCandidatePercent(
    env.RECIPE_AI_CANDIDATE_PERCENT,
  );

  if (!candidateModel || candidatePercent <= 0) {
    return { model: controlModel, variant: "control" };
  }

  if (candidatePercent >= 100 || recipeModelBucket(ownerKey) < candidatePercent) {
    return { model: candidateModel, variant: "candidate" };
  }

  return { model: controlModel, variant: "control" };
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
