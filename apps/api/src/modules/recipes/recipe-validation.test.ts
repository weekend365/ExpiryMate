import type {
  RecipeInventorySnapshotItem,
  RecipePreference,
  RecipeRecommendationDish,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import { ProductCategory, UnitCode } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import { validateAlignedRecommendations, validateGeneratedRecommendations } from "./recipe-validation";

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
    steps: ["준비해요", "섞어요", "익혀요", "담아요"],
    tips: ["약불을 유지해요"],
    safetyNote: "상태를 확인해요",
    spiceLevel: "none",
    requiredEquipment: ["stovetop"],
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

  it("aligns unit and clamps amount to inventory before validation", () => {
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

    expect(result.valid).toBe(true);
    expect(result.recommendations[0]?.usedIngredients[0]).toMatchObject({
      name: "달걀",
      amount: 3,
      unitCode: UnitCode.EA,
    });
  });
});
