import {
  ExpirySource,
  ItemStatus,
  type InventoryItem,
  type RecipeRecommendationDish,
  UnitCode,
} from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  buildBatchConsumeItems,
  buildCookingSteps,
  buildDefaultConsumptionChoices,
  resolveConsumableIngredients,
  resolveConsumptionAmount,
} from "./cooking";

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
      inventoryItemId: null,
      name: "소금",
    },
  ],
  optionalMissingIngredients: [],
  steps: ["우유를 데워요.", "계란을 풀어 넣어요."],
  tips: ["약불로 천천히 저어 주세요."],
  safetyNote: "우유의 냄새를 먼저 살펴보세요.",
};

const milk: InventoryItem = {
  id: "milk-1",
  displayName: "서울우유 1L",
  quantity: 1,
  unit: "팩",
  quantityBase: 1000,
  unitCode: UnitCode.ML,
  storageLocation: "fridge",
  expiryDate: "2026-07-24",
  expirySource: ExpirySource.MANUAL,
  status: ItemStatus.ACTIVE,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const egg: InventoryItem = {
  ...milk,
  id: "egg-1",
  displayName: "계란 10구",
  quantity: 1,
  unit: "판",
  quantityBase: 10,
  unitCode: UnitCode.EA,
};

describe("cooking flow helpers", () => {
  it("builds prep, cook, and inventory steps", () => {
    const steps = buildCookingSteps(dish);
    expect(steps.map((step) => step.key)).toEqual([
      "prep",
      "cook-0",
      "cook-1",
      "inventory",
    ]);
  });

  it("resolves only active inventory-linked ingredients", () => {
    const ingredients = resolveConsumableIngredients(dish, [
      milk,
      { ...egg, status: ItemStatus.CONSUMED },
    ]);

    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.inventoryItemId).toBe("milk-1");
    expect(ingredients[0]?.recommendedAmountBase).toBe(500);
  });

  it("defaults to recommended amounts when available", () => {
    const ingredients = resolveConsumableIngredients(dish, [milk, egg]);
    const choices = buildDefaultConsumptionChoices(ingredients);

    expect(choices["milk-1"]).toEqual({
      mode: "recommended",
      amountBase: 500,
    });
    expect(choices["egg-1"]).toEqual({
      mode: "recommended",
      amountBase: 2,
    });
  });

  it("supports full and half consumption amounts", () => {
    expect(resolveConsumptionAmount("full", 1000, 500)).toBe(1000);
    expect(resolveConsumptionAmount("half", 1000, 500)).toBe(500);
    expect(resolveConsumptionAmount("half", 3, null)).toBe(1);
    expect(resolveConsumptionAmount("recommended", 1000, 500)).toBe(500);
  });

  it("builds batch consume payloads from selected choices", () => {
    const ingredients = resolveConsumableIngredients(dish, [milk, egg]);
    const items = buildBatchConsumeItems(ingredients, {
      "milk-1": { mode: "half", amountBase: 500 },
      "egg-1": { mode: "skip", amountBase: 0 },
    });

    expect(items).toEqual([{ inventoryItemId: "milk-1", amountBase: 500 }]);
  });
});
