import { UnitCode, type RecipeRecommendationDish } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  formatDishMeta,
  formatIngredientDdayLabel,
  formatIngredientPreview,
  getHighlightedIngredients,
} from "./recipe-detail";

const dish: RecipeRecommendationDish = {
  title: "우유 달걀죽",
  summary: "부드럽게 끓이는 한 끼예요.",
  cookingTimeMinutes: 15,
  difficulty: "easy",
  servings: 2,
  usedIngredients: [
    {
      inventoryItemId: "milk-1",
      name: "우유",
      amount: 500,
      unitCode: UnitCode.ML,
    },
    {
      inventoryItemId: "egg-1",
      name: "계란",
      amount: 2,
      unitCode: UnitCode.EA,
    },
    {
      inventoryItemId: "rice-1",
      name: "쌀",
      amount: 100,
      unitCode: UnitCode.G,
    },
  ],
  optionalMissingIngredients: [],
  steps: ["끓이기"],
  tips: [],
  safetyNote: "",
  spiceLevel: "none",
  requiredEquipment: ["stovetop"],
};

describe("recipe-detail", () => {
  it("formats dish meta with spice and equipment", () => {
    expect(formatDishMeta(dish)).toBe("2인분 · 15분 · 쉬움 · 안 매움 · 가스/인덕션");
  });

  it("formats ingredient preview with overflow", () => {
    expect(
      formatIngredientPreview(
        getHighlightedIngredients(dish, [
          {
            inventoryItemId: "milk-1",
            name: "우유",
            quantity: 500,
            storageLocation: "fridge",
            expiryDate: "2026-08-29",
            daysUntilExpiry: 2,
          },
          {
            inventoryItemId: "egg-1",
            name: "계란",
            quantity: 2,
            storageLocation: "fridge",
            expiryDate: "2026-09-06",
            daysUntilExpiry: 10,
          },
          {
            inventoryItemId: "rice-1",
            name: "쌀",
            quantity: 100,
            storageLocation: "pantry",
            expiryDate: "2026-09-16",
            daysUntilExpiry: 20,
          },
        ]),
      ),
    ).toBe("재료 우유 · 계란 +1");
  });

  it("formats D-day labels", () => {
    expect(formatIngredientDdayLabel(null)).toBeNull();
    expect(formatIngredientDdayLabel(-2)).toBe("D+2");
    expect(formatIngredientDdayLabel(0)).toBe("오늘");
    expect(formatIngredientDdayLabel(3)).toBe("D-3");
  });
});
