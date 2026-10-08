import { describe, expect, it } from "vitest";
import { selectRecipeModel } from "./recipe-model-rollout";
import { recipePreferenceSchema, recipeRecommendationRequestSchema } from "@expirymate/shared";

describe("recipe model rollout", () => {
  const context = { request: recipeRecommendationRequestSchema.parse({}), inventoryCount: 3,
    preference: recipePreferenceSchema.parse({ allergens: [], excludedIngredients: [], dietaryStyle: "any", maxSpiceLevel: "any", availableEquipment: ["stovetop"], updatedAt: "2026-10-08" }) };
  const enabled = { RECIPE_AI_MODEL: "gpt-5.4-mini", RECIPE_AI_CANDIDATE_MODEL: "gpt-6-luna", RECIPE_AI_CANDIDATE_PERCENT: "100", RECIPE_AI_CANDIDATE_CONTROL_REPAIR: "true" };
  it("keeps safety constraints and complex requests on control", () => {
    for (const preference of [{ ...context.preference, allergens: ["egg" as const] }, { ...context.preference, excludedIngredients: ["버터"] }, { ...context.preference, dietaryStyle: "vegan" as const }, { ...context.preference, availableEquipment: ["microwave" as const] }]) {
      expect(selectRecipeModel("owner", enabled, { ...context, preference }).variant).toBe("control");
    }
    expect(selectRecipeModel("owner", enabled, { ...context, inventoryCount: 13 }).variant).toBe("control");
    expect(selectRecipeModel("owner", enabled, { ...context, request: { ...context.request, servings: 5 } }).variant).toBe("control");
  });
  it("supports opt-in control repair for simple requests", () => {
    expect(selectRecipeModel("owner", enabled, context)).toEqual({ model: "gpt-6-luna", variant: "candidate", repairModel: "gpt-5.4-mini" });
    expect(selectRecipeModel("owner", enabled, { ...context, inventoryCount: 12 }).variant).toBe("candidate");
  });
  it("uses the control model when rollout is disabled", () => {
    expect(
      selectRecipeModel("owner-a", {
        RECIPE_AI_MODEL: "gpt-5.4-mini",
        RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
        RECIPE_AI_CANDIDATE_PERCENT: "0",
      }),
    ).toEqual({ model: "gpt-5.4-mini", variant: "control" });
  });

  it("uses the candidate model for a 100 percent rollout", () => {
    expect(
      selectRecipeModel("owner-a", {
        RECIPE_AI_MODEL: "gpt-5.4-mini",
        RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
        RECIPE_AI_CANDIDATE_PERCENT: "100",
      }),
    ).toEqual({ model: "gpt-5.6-terra", variant: "candidate" });
  });

  it("keeps each owner in a stable bucket", () => {
    const env = {
      RECIPE_AI_MODEL: "gpt-5.4-mini",
      RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
      RECIPE_AI_CANDIDATE_PERCENT: "5",
    };
    const first = Array.from({ length: 500 }, (_, index) =>
      selectRecipeModel(`owner-${index}`, env),
    );

    expect(
      Array.from({ length: 500 }, (_, index) =>
        selectRecipeModel(`owner-${index}`, env),
      ),
    ).toEqual(first);
    expect(first.some(({ variant }) => variant === "candidate")).toBe(true);
    expect(first.some(({ variant }) => variant === "control")).toBe(true);
  });

  it("fails closed to control for invalid percentages", () => {
    expect(
      selectRecipeModel("owner-a", {
        RECIPE_AI_MODEL: "gpt-5.4-mini",
        RECIPE_AI_CANDIDATE_MODEL: "gpt-5.6-terra",
        RECIPE_AI_CANDIDATE_PERCENT: "5.5",
      }),
    ).toEqual({ model: "gpt-5.4-mini", variant: "control" });
  });
});
