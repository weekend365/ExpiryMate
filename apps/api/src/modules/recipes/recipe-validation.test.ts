import type {
  RecipeInventorySnapshotItem,
  RecipePreference,
  RecipeRecommendationDish,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import { ProductCategory, UnitCode } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  stripRecipeStrategyLabel,
  validateAlignedRecommendations,
  validateGeneratedRecommendations,
} from "./recipe-validation";

const request: RecipeRecommendationRequest = {
  servings: 2,
  maxCookingMinutes: 30,
  mealType: "dinner",
  useExpiringFirst: true,
};
const preference: RecipePreference = {
  allergens: [],
  excludedIngredients: [],
  dietaryStyle: "any",
  maxSpiceLevel: "mild",
  availableEquipment: ["stovetop"],
  updatedAt: "2026-08-10T00:00:00.000Z",
};
const inventory: RecipeInventorySnapshotItem[] = [
  {
    inventoryItemId: "egg-1",
    name: "달걀",
    category: ProductCategory.EGG,
    quantity: 3,
    quantityBase: 3,
    unitCode: UnitCode.EA,
    storageLocation: "fridge",
    expiryDate: "2026-08-11",
    daysUntilExpiry: 1,
  },
];
const radishInventoryItem: RecipeInventorySnapshotItem = {
  inventoryItemId: "radish-1",
  name: "무",
  category: ProductCategory.PRODUCE,
  quantity: 1,
  quantityBase: 1,
  unitCode: UnitCode.EA,
  storageLocation: "fridge",
  expiryDate: "2026-08-12",
  daysUntilExpiry: 2,
};

function dishes(): RecipeRecommendationDish[] {
  return [1, 2, 3].map((index) => ({
    title: `달걀 요리 ${index}`,
    summary: "간단한 한 끼",
    cookingTimeMinutes: 15,
    difficulty: "easy",
    servings: 2,
    usedIngredients: [
      { inventoryItemId: "egg-1", name: "계란", amount: 2, unitCode: UnitCode.EA },
    ],
    optionalMissingIngredients: [],
    steps: [
      "달걀의 냄새와 상태를 확인해요.",
      "달걀을 그릇에서 30초 동안 저어요.",
      "팬에서 중불로 3분 동안 익혀요.",
      "가장자리가 익으면 그릇에 담아요.",
    ],
    tips: ["약불을 유지해요"],
    safetyNote: "상태를 확인해요",
    spiceLevel: "none",
    requiredEquipment: ["stovetop"],
    mealType: "dinner",
    strategy: ["expiring_first", "minimal_extra", "quick_novel"][index - 1] as
      | "expiring_first"
      | "minimal_extra"
      | "quick_novel",
  }));
}

describe("recipe semantic validation", () => {
  it("canonicalizes valid inventory names", () => {
    const result = validateGeneratedRecommendations(dishes(), request, inventory, preference);
    expect(result.valid).toBe(true);
    expect(result.recommendations[0]?.usedIngredients[0]?.name).toBe("달걀");
  });

  it("reports inventory, quantity, request, and structure violations", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      servings: 1,
      cookingTimeMinutes: 45,
      steps: ["한 번에 끝내요"],
      tips: [],
      usedIngredients: [
        { inventoryItemId: "egg-1", name: "달걀", amount: 4, unitCode: UnitCode.G },
      ],
    };
    invalid[1] = { ...invalid[1]!, title: invalid[0]!.title };

    const result = validateGeneratedRecommendations(invalid, request, inventory, preference);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "DISH_1_SERVINGS_MISMATCH",
        "DISH_1_COOKING_TIME_EXCEEDED",
        "DISH_1_STEPS_MUST_BE_4_TO_8",
        "DISH_1_TIPS_MUST_BE_1_TO_3",
        "DISH_1_INGREDIENT_1_UNIT_MISMATCH",
        "DISH_1_INGREDIENT_1_QUANTITY_EXCEEDED",
        "DISH_2_DUPLICATE_TITLE",
      ]),
    );
  });

  it("rejects safety, spice, and equipment conflicts", () => {
    const restricted: RecipePreference = {
      ...preference,
      allergens: ["egg"],
      maxSpiceLevel: "none",
      availableEquipment: ["microwave"],
    };
    const result = validateGeneratedRecommendations(dishes(), request, inventory, restricted);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "DISH_1_BLOCKED_INGREDIENT_OR_DIET_CONFLICT",
        "DISH_1_UNAVAILABLE_EQUIPMENT",
      ]),
    );
  });

  it("rejects unknown and duplicate inventory ids", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      usedIngredients: [
        {
          inventoryItemId: "missing",
          name: "없는 재료",
          amount: 1,
          unitCode: UnitCode.EA,
        },
      ],
    };
    invalid[1] = {
      ...invalid[1]!,
      usedIngredients: [
        ...invalid[1]!.usedIngredients,
        ...invalid[1]!.usedIngredients,
      ],
    };

    expect(
      validateGeneratedRecommendations(invalid, request, inventory, preference)
        .violations,
    ).toEqual(
      expect.arrayContaining([
        "DISH_1_INGREDIENT_1_UNKNOWN_INVENTORY_ID",
        "DISH_2_INGREDIENT_2_DUPLICATE_INVENTORY_ID",
      ]),
    );
  });

  it("rejects dietary, spice, and missing-equipment metadata violations", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      title: "beef soup",
      spiceLevel: "hot",
      requiredEquipment: undefined,
    };
    const restricted: RecipePreference = {
      ...preference,
      dietaryStyle: "vegan",
      maxSpiceLevel: "mild",
    };

    expect(
      validateGeneratedRecommendations(invalid, request, inventory, restricted)
        .violations,
    ).toEqual(
      expect.arrayContaining([
        "DISH_1_BLOCKED_INGREDIENT_OR_DIET_CONFLICT",
        "DISH_1_SPICE_LEVEL_EXCEEDED",
        "DISH_1_EQUIPMENT_REQUIRED",
      ]),
    );
  });

  it("rejects missing strategy, meal-type, safety, and empty equipment rules", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      strategy: undefined,
      mealType: "breakfast",
      safetyNote: "",
      requiredEquipment: [],
    };

    expect(
      validateGeneratedRecommendations(invalid, request, inventory, preference)
        .violations,
    ).toEqual(
      expect.arrayContaining([
        "DISH_1_STRATEGY_REQUIRED",
        "DISH_1_MEAL_TYPE_MISMATCH",
        "DISH_1_SAFETY_NOTE_REQUIRED",
        "DISH_1_EQUIPMENT_REQUIRED",
        "RECOMMENDATION_STRATEGIES_MUST_BE_UNIQUE",
      ]),
    );
  });

  it("rejects ingredients used in instructions without a structured declaration", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      steps: ["버터 10g을 팬에서 약불로 1분 녹여요.", ...invalid[0]!.steps.slice(1)],
    };

    expect(
      validateGeneratedRecommendations(invalid, request, inventory, preference)
        .violations,
    ).toContain("DISH_1_UNDECLARED_INGREDIENT:버터");
  });

  it("does not mistake a single-character ingredient inside unrelated words", () => {
    const result = validateGeneratedRecommendations(
      dishes().map((dish) => ({
        ...dish,
        tips: ["너무 오래 익히거나 무르게 만들지 마세요."],
      })),
      request,
      [...inventory, radishInventoryItem],
      preference,
    );

    expect(result.valid).toBe(true);
    expect(result.violations).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("UNDECLARED_INGREDIENT:무"),
      ]),
    );
  });

  it("still rejects an actual single-character ingredient mention", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      steps: ["무를 1cm 크기로 썰어요.", ...invalid[0]!.steps.slice(1)],
    };

    expect(
      validateGeneratedRecommendations(
        invalid,
        request,
        [...inventory, radishInventoryItem],
        preference,
      ).violations,
    ).toContain("DISH_1_UNDECLARED_INGREDIENT:무");
  });

  it("accepts a declared single-character ingredient mention", () => {
    const declared = dishes();
    declared[0] = {
      ...declared[0]!,
      usedIngredients: [
        ...declared[0]!.usedIngredients,
        {
          inventoryItemId: radishInventoryItem.inventoryItemId,
          name: radishInventoryItem.name,
          amount: 1,
          unitCode: UnitCode.EA,
        },
      ],
      steps: ["무를 1cm 크기로 썰어요.", ...declared[0]!.steps.slice(1)],
    };

    expect(
      validateGeneratedRecommendations(
        declared,
        request,
        [...inventory, radishInventoryItem],
        preference,
      ).violations,
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("UNDECLARED_INGREDIENT:무"),
      ]),
    );
  });

  it("disables optional ingredient suggestions when safety restrictions apply", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      optionalMissingIngredients: [{ name: "대파", reason: "향을 더해요" }],
    };
    const restricted = { ...preference, allergens: ["milk" as const] };

    expect(
      validateGeneratedRecommendations(invalid, request, inventory, restricted)
        .violations,
    ).toContain("DISH_1_OPTIONAL_INGREDIENTS_DISABLED_FOR_SAFETY");
  });

  it("keeps invalid units and amounts so repair can correct the whole recipe", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      usedIngredients: [
        {
          inventoryItemId: "egg-1",
          name: "계란",
          amount: 8,
          unitCode: UnitCode.G,
        },
      ],
    };

    const result = validateAlignedRecommendations(
      invalid,
      request,
      inventory,
      preference,
    );

    expect(result.valid).toBe(false);
    expect(result.recommendations[0]?.usedIngredients[0]).toMatchObject({
      name: "달걀",
      amount: 8,
      unitCode: UnitCode.G,
    });
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "DISH_1_INGREDIENT_1_UNIT_MISMATCH",
        "DISH_1_INGREDIENT_1_QUANTITY_EXCEEDED",
      ]),
    );
  });

  it("leaves ingredients without an inventory id unchanged", () => {
    const invalid = dishes();
    invalid[0] = {
      ...invalid[0]!,
      usedIngredients: [{ inventoryItemId: null, name: "우유", amount: 200 }],
    };

    const result = validateAlignedRecommendations(
      invalid,
      request,
      inventory,
      preference,
    );

    expect(result.recommendations[0]?.usedIngredients[0]).toMatchObject({
      inventoryItemId: null,
      name: "우유",
      amount: 200,
    });
    expect(result.violations).toEqual(
      expect.arrayContaining(["DISH_1_INGREDIENT_1_INVENTORY_ID_REQUIRED"]),
    );
  });

  it("strips strategy labels from dish titles and leftover ingredient names", () => {
    expect(stripRecipeStrategyLabel("임박 재료 우선: 계란볶음밥")).toBe(
      "계란볶음밥",
    );
    expect(stripRecipeStrategyLabel("추가 재료 최소형: 두부조림")).toBe(
      "두부조림",
    );
    expect(
      stripRecipeStrategyLabel("빠르고 새로운 탐색형: 토마토 파스타"),
    ).toBe("토마토 파스타");

    const labeled = dishes();
    labeled[0] = {
      ...labeled[0]!,
      title: "임박 재료 우선: 달걀볶음",
    };

    const result = validateAlignedRecommendations(
      labeled,
      request,
      inventory,
      preference,
    );

    expect(result.recommendations[0]?.title).toBe("달걀볶음");
  });
});
