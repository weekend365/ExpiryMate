import { describe, expect, it } from "vitest";
import { UnitCode } from "../enums/app-enums";
import {
  generatedRecipeRecommendationsPayloadSchema,
  recipeRecommendationDishSchema,
} from "./recipes";

const dish = {
  title: "우유 달걀죽",
  summary: "부드럽게 끓이는 한 끼예요.",
  cookingTimeMinutes: 15,
  difficulty: "easy" as const,
  servings: 2,
  usedIngredients: [{ inventoryItemId: "milk-1", name: "우유" }],
  optionalMissingIngredients: [],
  steps: ["우유를 약불에 데워요."],
  tips: [],
  safetyNote: "우유의 냄새와 상태를 먼저 살펴보세요.",
};

describe("recipe ingredient quantity contracts", () => {
  it("keeps stored legacy recommendations readable", () => {
    expect(recipeRecommendationDishSchema.safeParse(dish).success).toBe(true);
  });

  it("requires canonical amounts for newly generated recommendations", () => {
    const result = generatedRecipeRecommendationsPayloadSchema.safeParse({
      recommendations: [0, 1, 2].map(() => ({
        ...dish,
        usedIngredients: [
          {
            inventoryItemId: "milk-1",
            name: "우유",
            amount: 500,
            unitCode: UnitCode.ML,
          },
        ],
      })),
    });

    expect(result.success).toBe(true);
    expect(
      generatedRecipeRecommendationsPayloadSchema.safeParse({
        recommendations: [dish, dish, dish],
      }).success,
    ).toBe(false);
  });
});
