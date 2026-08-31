import { describe, expect, it } from "vitest";
import { UnitCode } from "../enums/app-enums";
import {
  recipeFavoriteSchema,
  generatedRecipeRecommendationsPayloadSchema,
  updateRecipePreferenceSchema,
  recipeRecommendationDishSchema,
  recipeRecommendationRequestSchema,
  type RecipeStrategy,
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

function generatedDishes() {
  return [0, 1, 2].map((index) => ({
    ...dish,
    optionalMissingIngredients: [] as Array<{ name: string; reason: string }>,
    mealType: "breakfast" as const,
    strategy: ["expiring_first", "minimal_extra", "quick_novel"][
      index
    ] as RecipeStrategy,
    spiceLevel: "mild" as const,
    requiredEquipment: ["stovetop" as const],
    steps: [
      "우유를 약불에서 2분 데워요.",
      "달걀을 넣고 1분 저어요.",
      "약불에서 5분 천천히 끓여요.",
      "상태를 확인한 뒤 그릇에 담아요.",
    ],
    tips: ["너무 되직하면 물을 조금 넣어요."],
    usedIngredients: [
      {
        inventoryItemId: "milk-1",
        name: "우유",
        amount: 500,
        unitCode: UnitCode.ML,
      },
    ],
  }));
}

describe("recipe recommendation request contracts", () => {
  it("accepts an optional bounded ingredient selection", () => {
    expect(
      recipeRecommendationRequestSchema.parse({
        selectedInventoryItemIds: ["milk-1", "egg-1"],
      }).selectedInventoryItemIds,
    ).toEqual(["milk-1", "egg-1"]);
    expect(
      recipeRecommendationRequestSchema.safeParse({
        selectedInventoryItemIds: [],
      }).success,
    ).toBe(false);
  });
});

describe("recipe ingredient quantity contracts", () => {
  it("keeps stored legacy recommendations readable", () => {
    expect(recipeRecommendationDishSchema.safeParse(dish).success).toBe(true);
  });

  it("accepts additive step timer metadata without requiring it for legacy data", () => {
    const result = recipeRecommendationDishSchema.parse({
      ...dish,
      stepTimerSeconds: [120],
    });

    expect(result.stepTimerSeconds).toEqual([120]);
  });

  it("requires canonical amounts for newly generated recommendations", () => {
    const result = generatedRecipeRecommendationsPayloadSchema.safeParse({
      recommendations: generatedDishes(),
    });

    expect(result.success).toBe(true);
    expect(
      generatedRecipeRecommendationsPayloadSchema.safeParse({
        recommendations: [dish, dish, dish],
      }).success,
    ).toBe(false);
  });

  it("accepts the balanced strategy used when expiry-first is off", () => {
    const recommendations = generatedDishes();
    recommendations[0] = { ...recommendations[0]!, strategy: "balanced" };

    expect(
      generatedRecipeRecommendationsPayloadSchema.safeParse({ recommendations })
        .success,
    ).toBe(true);
  });

  it("enforces generated-only safety and structure limits", () => {
    const recommendations = generatedDishes();
    recommendations[0] = {
      ...recommendations[0]!,
      optionalMissingIngredients: [
        { name: "대파", reason: "향을 더해요" },
        { name: "마늘", reason: "풍미를 더해요" },
        { name: "버터", reason: "고소하게 해요" },
      ],
      safetyNote: "",
      tips: [""],
      requiredEquipment: [],
    };

    expect(
      generatedRecipeRecommendationsPayloadSchema.safeParse({ recommendations })
        .success,
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
