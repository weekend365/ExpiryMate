import { describe, expect, it } from "vitest";
import { UnitCode } from "../enums/app-enums";
import {
  recipeFavoriteSchema,
  generatedRecipeRecommendationsPayloadSchema,
  updateRecipePreferenceSchema,
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
        spiceLevel: "mild",
        requiredEquipment: ["stovetop"],
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

describe("recipe preference contracts", () => {
  it("trims and deduplicates user-entered exclusions", () => {
    const parsed = updateRecipePreferenceSchema.parse({
      allergens: ["egg", "egg"],
      excludedIngredients: [" 고수 ", "고수"],
      dietaryStyle: "any",
      maxSpiceLevel: "mild",
      availableEquipment: ["stovetop", "stovetop"],
    });

    expect(parsed.allergens).toEqual(["egg"]);
    expect(parsed.excludedIngredients).toEqual(["고수"]);
    expect(parsed.availableEquipment).toEqual(["stovetop"]);
  });

  it("requires at least one available cooking tool", () => {
    expect(
      updateRecipePreferenceSchema.safeParse({
        allergens: [],
        excludedIngredients: [],
        dietaryStyle: "any",
        maxSpiceLevel: "any",
        availableEquipment: [],
      }).success,
    ).toBe(false);
  });
});

describe("recipe favorite contracts", () => {
  it("keeps the saved dish and inventory snapshot together", () => {
    const result = recipeFavoriteSchema.safeParse({
      id: "favorite-1",
      ownerKey: "user-1",
      sourceRecommendationId: "recommendation-1",
      sourceDishIndex: 0,
      dish,
      inventorySnapshot: [
        {
          inventoryItemId: "milk-1",
          name: "우유",
          quantity: 1,
          storageLocation: "fridge",
          expiryDate: "2099-06-10",
          daysUntilExpiry: 3,
        },
      ],
      createdAt: "2099-06-07T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});
