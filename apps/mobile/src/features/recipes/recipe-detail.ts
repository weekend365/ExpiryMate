import {
  formatBaseQuantity,
  type RecipeInventorySnapshotItem,
  type RecipeRecommendationDish,
} from "@expirymate/shared";

export const COLLAPSED_INGREDIENT_PREVIEW_COUNT = 2;
export const EXPIRING_DAYS_THRESHOLD = 7;

export type HighlightIngredient = {
  key: string;
  name: string;
  amountLabel: string | null;
  daysUntilExpiry: number | null;
  isExpiring: boolean;
};

export type RecipeDetailSelection = {
  recommendationId: string;
  dishIndex: number;
  dish: RecipeRecommendationDish;
  inventorySnapshot: RecipeInventorySnapshotItem[];
};

export const difficultyLabels: Record<
  RecipeRecommendationDish["difficulty"],
  string
> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export const spiceLevelLabels = {
  none: "안 매움",
  mild: "순한맛",
  medium: "보통맛",
  hot: "매운맛",
} as const;

export const equipmentLabels = {
  stovetop: "가스/인덕션",
  microwave: "전자레인지",
  oven: "오븐",
  air_fryer: "에어프라이어",
} as const;

export function getUsedIngredientRows(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
): HighlightIngredient[] {
  const snapshotById = new Map(
    inventorySnapshot.map((item) => [item.inventoryItemId, item]),
  );

  return dish.usedIngredients.map((ingredient, index) => {
    const snapshot = ingredient.inventoryItemId
      ? snapshotById.get(ingredient.inventoryItemId)
      : undefined;
    const daysUntilExpiry = snapshot?.daysUntilExpiry ?? null;
    const isExpiring =
      typeof daysUntilExpiry === "number" &&
      daysUntilExpiry <= EXPIRING_DAYS_THRESHOLD;

    return {
      key: ingredient.inventoryItemId ?? `${ingredient.name}-${index}`,
      name: ingredient.name,
      amountLabel:
        ingredient.amount && ingredient.unitCode
          ? formatBaseQuantity(ingredient.amount, ingredient.unitCode)
          : null,
      daysUntilExpiry,
      isExpiring,
    } satisfies HighlightIngredient;
  });
}

export function getHighlightedIngredients(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
): HighlightIngredient[] {
  const resolved = getUsedIngredientRows(dish, inventorySnapshot);

  const expiring = resolved
    .filter((ingredient) => ingredient.isExpiring)
    .sort(
      (left, right) =>
        (left.daysUntilExpiry ?? Number.POSITIVE_INFINITY) -
        (right.daysUntilExpiry ?? Number.POSITIVE_INFINITY),
    );

  if (expiring.length > 0) {
    const nonExpiring = resolved.filter((ingredient) => !ingredient.isExpiring);
    return [...expiring, ...nonExpiring];
  }

  return resolved;
}

export function formatDishMeta(dish: RecipeRecommendationDish) {
  const values = [
    `${dish.servings}인분`,
    `${dish.cookingTimeMinutes}분`,
    difficultyLabels[dish.difficulty],
  ];
  if (dish.spiceLevel) values.push(spiceLevelLabels[dish.spiceLevel]);
  if (dish.requiredEquipment?.length) {
    values.push(
      dish.requiredEquipment.map((item) => equipmentLabels[item]).join("/"),
    );
  }
  return values.join(" · ");
}

export function formatIngredientPreview(ingredients: HighlightIngredient[]) {
  if (ingredients.length === 0) {
    return "재료 정보 없음";
  }

  const visibleNames = ingredients
    .slice(0, COLLAPSED_INGREDIENT_PREVIEW_COUNT)
    .map((ingredient) => ingredient.name);
  const remainingCount = ingredients.length - visibleNames.length;

  return `재료 ${visibleNames.join(" · ")}${
    remainingCount > 0 ? ` +${remainingCount}` : ""
  }`;
}

export function formatIngredientDdayLabel(daysUntilExpiry: number | null) {
  if (daysUntilExpiry == null) {
    return null;
  }

  if (daysUntilExpiry < 0) {
    return `D+${Math.abs(daysUntilExpiry)}`;
  }

  if (daysUntilExpiry === 0) {
    return "오늘";
  }

  return `D-${daysUntilExpiry}`;
}
