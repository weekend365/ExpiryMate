import type {
  RecipeInventorySnapshotItem,
  RecipePreference,
  RecipeRecommendationDish,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import {
  isRecipeTextBlocked,
  normalizeRecipeTerm,
} from "./recipe-ranking";

export interface RecipeValidationResult {
  valid: boolean;
  recommendations: RecipeRecommendationDish[];
  violations: string[];
}

const spiceRank = { none: 0, mild: 1, medium: 2, hot: 3 } as const;

export function alignUsedIngredientsToInventory(
  recommendations: RecipeRecommendationDish[],
  inventorySnapshot: RecipeInventorySnapshotItem[],
): RecipeRecommendationDish[] {
  const inventoryById = new Map(
    inventorySnapshot.map((item) => [item.inventoryItemId, item]),
  );

  return recommendations.map((dish) => ({
    ...dish,
    usedIngredients: dish.usedIngredients.map((ingredient) => {
      if (!ingredient.inventoryItemId) {
        return ingredient;
      }

      const inventoryItem = inventoryById.get(ingredient.inventoryItemId);
      if (!inventoryItem) {
        return ingredient;
      }

      const maxAmount = inventoryItem.quantityBase;
      const nextAmount =
        typeof ingredient.amount === "number" &&
        Number.isFinite(ingredient.amount) &&
        maxAmount !== undefined
          ? Math.min(Math.max(1, Math.floor(ingredient.amount)), maxAmount)
          : ingredient.amount;

      return {
        ...ingredient,
        name: inventoryItem.name,
        unitCode: inventoryItem.unitCode,
        amount: nextAmount,
      };
    }),
  }));
}

export function validateAlignedRecommendations(
  recommendations: RecipeRecommendationDish[],
  request: RecipeRecommendationRequest,
  inventorySnapshot: RecipeInventorySnapshotItem[],
  preference: RecipePreference,
): RecipeValidationResult {
  return validateGeneratedRecommendations(
    alignUsedIngredientsToInventory(recommendations, inventorySnapshot),
    request,
    inventorySnapshot,
    preference,
  );
}

export function validateGeneratedRecommendations(
  recommendations: RecipeRecommendationDish[],
  request: RecipeRecommendationRequest,
  inventorySnapshot: RecipeInventorySnapshotItem[],
  preference: RecipePreference,
): RecipeValidationResult {
  const violations: string[] = [];
  const inventoryById = new Map(
    inventorySnapshot.map((item) => [item.inventoryItemId, item]),
  );
  const seenTitles = new Set<string>();

  if (recommendations.length !== 3) {
    violations.push("RECOMMENDATION_COUNT_MUST_BE_3");
  }

  const normalizedRecommendations = recommendations.map((dish, dishIndex) => {
    const prefix = `DISH_${dishIndex + 1}`;
    const normalizedTitle = normalizeRecipeTerm(dish.title);
    if (!normalizedTitle || seenTitles.has(normalizedTitle)) {
      violations.push(`${prefix}_DUPLICATE_TITLE`);
    }
    seenTitles.add(normalizedTitle);

    if (dish.servings !== request.servings) {
      violations.push(`${prefix}_SERVINGS_MISMATCH`);
    }
    if (dish.cookingTimeMinutes > request.maxCookingMinutes) {
      violations.push(`${prefix}_COOKING_TIME_EXCEEDED`);
    }
    if (dish.steps.length < 4 || dish.steps.length > 8) {
      violations.push(`${prefix}_STEPS_MUST_BE_4_TO_8`);
    }
    if (dish.tips.length < 1 || dish.tips.length > 3) {
      violations.push(`${prefix}_TIPS_MUST_BE_1_TO_3`);
    }
    if (dish.usedIngredients.length === 0) {
      violations.push(`${prefix}_USED_INGREDIENT_REQUIRED`);
    }
    if (!dish.spiceLevel) {
      violations.push(`${prefix}_SPICE_LEVEL_REQUIRED`);
    } else if (
      preference.maxSpiceLevel !== "any" &&
      spiceRank[dish.spiceLevel] > spiceRank[preference.maxSpiceLevel]
    ) {
      violations.push(`${prefix}_SPICE_LEVEL_EXCEEDED`);
    }
    if (!dish.requiredEquipment) {
      violations.push(`${prefix}_EQUIPMENT_REQUIRED`);
    } else {
      const available = new Set(preference.availableEquipment);
      if (dish.requiredEquipment.some((item) => !available.has(item))) {
        violations.push(`${prefix}_UNAVAILABLE_EQUIPMENT`);
      }
    }

    const seenIngredientIds = new Set<string>();
    const usedIngredients = dish.usedIngredients.map((ingredient, ingredientIndex) => {
      const ingredientPrefix = `${prefix}_INGREDIENT_${ingredientIndex + 1}`;
      if (!ingredient.inventoryItemId) {
        violations.push(`${ingredientPrefix}_INVENTORY_ID_REQUIRED`);
        return ingredient;
      }
      if (seenIngredientIds.has(ingredient.inventoryItemId)) {
        violations.push(`${ingredientPrefix}_DUPLICATE_INVENTORY_ID`);
      }
      seenIngredientIds.add(ingredient.inventoryItemId);

      const inventoryItem = inventoryById.get(ingredient.inventoryItemId);
      if (!inventoryItem) {
        violations.push(`${ingredientPrefix}_UNKNOWN_INVENTORY_ID`);
        return ingredient;
      }
      if (!ingredient.amount || !ingredient.unitCode) {
        violations.push(`${ingredientPrefix}_AMOUNT_AND_UNIT_REQUIRED`);
      } else {
        if (inventoryItem.unitCode !== ingredient.unitCode) {
          violations.push(`${ingredientPrefix}_UNIT_MISMATCH`);
        }
        if (
          inventoryItem.quantityBase !== undefined &&
          ingredient.amount > inventoryItem.quantityBase
        ) {
          violations.push(`${ingredientPrefix}_QUANTITY_EXCEEDED`);
        }
      }

      return { ...ingredient, name: inventoryItem.name };
    });

    const textToCheck = [
      dish.title,
      dish.summary,
      ...usedIngredients.map((item) => item.name),
      ...dish.optionalMissingIngredients.flatMap((item) => [item.name, item.reason]),
      ...dish.steps,
      ...dish.tips,
    ].join(" ");
    if (isRecipeTextBlocked(textToCheck, preference)) {
      violations.push(`${prefix}_BLOCKED_INGREDIENT_OR_DIET_CONFLICT`);
    }

    return { ...dish, usedIngredients };
  });

  return {
    valid: violations.length === 0,
    recommendations: normalizedRecommendations,
    violations,
  };
}
