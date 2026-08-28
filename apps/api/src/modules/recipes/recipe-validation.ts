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

const RECIPE_STRATEGY_LABEL_PATTERN =
  /^(임박\s*재료\s*(우선|활용형)|추가\s*재료\s*최소형|빠르고\s*새로운\s*탐색형)(?:\s*[:：\-–]\s*|\s+)/u;

export function stripRecipeStrategyLabel(value: string) {
  const trimmed = value.trim();
  const stripped = trimmed.replace(RECIPE_STRATEGY_LABEL_PATTERN, "").trim();
  return stripped.length > 0 ? stripped : trimmed;
}

export function sanitizeRecipeRecommendationCopy(
  recommendations: RecipeRecommendationDish[],
): RecipeRecommendationDish[] {
  return recommendations.map((dish) => ({
    ...dish,
    title: stripRecipeStrategyLabel(dish.title),
    usedIngredients: dish.usedIngredients.map((ingredient) => ({
      ...ingredient,
      name: stripRecipeStrategyLabel(ingredient.name),
    })),
    optionalMissingIngredients: dish.optionalMissingIngredients.map((item) => ({
      ...item,
      name: stripRecipeStrategyLabel(item.name),
    })),
  }));
}

export function canonicalizeUsedIngredientNames(
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

      return {
        ...ingredient,
        name: inventoryItem.name,
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
    canonicalizeUsedIngredientNames(
      sanitizeRecipeRecommendationCopy(recommendations),
      inventorySnapshot,
    ),
    request,
    inventorySnapshot,
    preference,
  );
}

const recipeStrategies = new Set([
  "expiring_first",
  "minimal_extra",
  "quick_novel",
]);

const basicSeasoningTerms = new Set([
  "물",
  "소금",
  "후추",
  "식용유",
  "기름",
  "올리브유",
]);

const commonIngredientTerms = [
  "달걀",
  "계란",
  "우유",
  "치즈",
  "버터",
  "요거트",
  "크림",
  "두부",
  "콩",
  "간장",
  "된장",
  "고추장",
  "밀가루",
  "파스타",
  "라면",
  "국수",
  "설탕",
  "꿀",
  "마요네즈",
  "케첩",
  "식초",
  "액젓",
  "육수",
  "돼지고기",
  "소고기",
  "닭고기",
  "햄",
  "베이컨",
  "새우",
  "게살",
  "꽃게",
  "굴",
  "토마토",
  "땅콩",
  "호두",
];

const ingredientAliasGroups = [
  ["달걀", "계란"],
  ["소고기", "쇠고기"],
  ["대두", "콩"],
];

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
  const seenStrategies = new Set<string>();

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

    if (!dish.strategy || !recipeStrategies.has(dish.strategy)) {
      violations.push(`${prefix}_STRATEGY_REQUIRED`);
    } else if (seenStrategies.has(dish.strategy)) {
      violations.push(`${prefix}_DUPLICATE_STRATEGY`);
    } else {
      seenStrategies.add(dish.strategy);
    }

    if (request.mealType !== "any" && dish.mealType !== request.mealType) {
      violations.push(`${prefix}_MEAL_TYPE_MISMATCH`);
    }

    if (dish.servings !== request.servings) {
      violations.push(`${prefix}_SERVINGS_MISMATCH`);
    }
    if (dish.cookingTimeMinutes > request.maxCookingMinutes) {
      violations.push(`${prefix}_COOKING_TIME_EXCEEDED`);
    }
    if (dish.steps.length < 4 || dish.steps.length > 8) {
      violations.push(`${prefix}_STEPS_MUST_BE_4_TO_8`);
    }
    if (dish.steps.some((step) => step.trim().length < 8)) {
      violations.push(`${prefix}_STEPS_MUST_BE_DETAILED`);
    }
    if (dish.tips.length < 1 || dish.tips.length > 3) {
      violations.push(`${prefix}_TIPS_MUST_BE_1_TO_3`);
    }
    if (dish.tips.some((tip) => tip.trim().length === 0)) {
      violations.push(`${prefix}_TIP_MUST_NOT_BE_EMPTY`);
    }
    if (dish.optionalMissingIngredients.length > 2) {
      violations.push(`${prefix}_OPTIONAL_INGREDIENTS_MUST_BE_0_TO_2`);
    }
    if (
      (preference.allergens.length > 0 || preference.dietaryStyle !== "any") &&
      dish.optionalMissingIngredients.length > 0
    ) {
      violations.push(`${prefix}_OPTIONAL_INGREDIENTS_DISABLED_FOR_SAFETY`);
    }
    if (dish.safetyNote.trim().length < 6) {
      violations.push(`${prefix}_SAFETY_NOTE_REQUIRED`);
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
    if (!dish.requiredEquipment || dish.requiredEquipment.length === 0) {
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
      dish.safetyNote,
    ].join(" ");
    if (isRecipeTextBlocked(textToCheck, preference)) {
      violations.push(`${prefix}_BLOCKED_INGREDIENT_OR_DIET_CONFLICT`);
    }

    const undeclaredIngredients = findUndeclaredIngredientTerms(
      dish,
      inventorySnapshot,
    );
    if (undeclaredIngredients.length > 0) {
      violations.push(
        `${prefix}_UNDECLARED_INGREDIENT:${undeclaredIngredients.join(",")}`,
      );
    }

    if (dish.strategy === "expiring_first") {
      const minimumDays = Math.min(
        ...inventorySnapshot.map((item) => item.daysUntilExpiry),
      );
      const urgentIds = new Set(
        inventorySnapshot
          .filter((item) => item.daysUntilExpiry === minimumDays)
          .map((item) => item.inventoryItemId),
      );
      if (
        !usedIngredients.some(
          (ingredient) =>
            ingredient.inventoryItemId && urgentIds.has(ingredient.inventoryItemId),
        )
      ) {
        violations.push(`${prefix}_EXPIRING_INGREDIENT_REQUIRED`);
      }
    }

    return { ...dish, usedIngredients };
  });

  if (seenStrategies.size !== recipeStrategies.size) {
    violations.push("RECOMMENDATION_STRATEGIES_MUST_BE_UNIQUE");
  }

  const minimalExtraDish = normalizedRecommendations.find(
    (dish) => dish.strategy === "minimal_extra",
  );
  if (
    minimalExtraDish &&
    minimalExtraDish.optionalMissingIngredients.length !==
      Math.min(
        ...normalizedRecommendations.map(
          (dish) => dish.optionalMissingIngredients.length,
        ),
      )
  ) {
    violations.push("MINIMAL_EXTRA_STRATEGY_HAS_TOO_MANY_OPTIONAL_INGREDIENTS");
  }

  const quickNovelDish = normalizedRecommendations.find(
    (dish) => dish.strategy === "quick_novel",
  );
  if (
    quickNovelDish &&
    quickNovelDish.cookingTimeMinutes !==
      Math.min(
        ...normalizedRecommendations.map((dish) => dish.cookingTimeMinutes),
      )
  ) {
    violations.push("QUICK_NOVEL_STRATEGY_MUST_BE_FASTEST");
  }

  return {
    valid: violations.length === 0,
    recommendations: normalizedRecommendations,
    violations,
  };
}

function findUndeclaredIngredientTerms(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
) {
  const instructionText = normalizeRecipeTerm(
    [...dish.steps, ...dish.tips].join(" "),
  );
  const declaredNames = [
    ...dish.usedIngredients.map((ingredient) => ingredient.name),
    ...dish.optionalMissingIngredients.map((ingredient) => ingredient.name),
  ].map(normalizeRecipeTerm);
  const candidateTerms = new Set([
    ...commonIngredientTerms.map(normalizeRecipeTerm),
    ...inventorySnapshot.map((item) => normalizeRecipeTerm(item.name)),
  ]);

  return [...candidateTerms].filter((term) => {
    if (!term || basicSeasoningTerms.has(term) || !instructionText.includes(term)) {
      return false;
    }
    return !isDeclaredIngredientTerm(term, declaredNames);
  });
}

function isDeclaredIngredientTerm(term: string, declaredNames: string[]) {
  if (
    declaredNames.some(
      (declared) => declared.includes(term) || term.includes(declared),
    )
  ) {
    return true;
  }

  return ingredientAliasGroups.some((group) => {
    const normalizedGroup = group.map(normalizeRecipeTerm);
    return (
      normalizedGroup.includes(term) &&
      declaredNames.some((declared) =>
        normalizedGroup.some(
          (alias) => declared.includes(alias) || alias.includes(declared),
        ),
      )
    );
  });
}
