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

export type RecipeDecisionSignals = {
  badges: string[];
  rationale: string;
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

export function getRecipeDecisionSignals(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
): RecipeDecisionSignals {
  const ingredients = getUsedIngredientRows(dish, inventorySnapshot);
  const expiring = ingredients
    .filter((ingredient) => ingredient.isExpiring)
    .sort(
      (left, right) =>
        (left.daysUntilExpiry ?? Number.POSITIVE_INFINITY) -
        (right.daysUntilExpiry ?? Number.POSITIVE_INFINITY),
    );
  const inventoryIds = new Set(
    inventorySnapshot.map((item) => item.inventoryItemId),
  );
  const ownedCount = dish.usedIngredients.filter(
    (ingredient) =>
      ingredient.inventoryItemId && inventoryIds.has(ingredient.inventoryItemId),
  ).length;
  const missingCount = dish.optionalMissingIngredients.length;
  const totalCount = ownedCount + missingCount;
  const badges = [
    expiring.length > 0
      ? `${formatIngredientDdayLabel(expiring[0]?.daysUntilExpiry ?? null) ?? "임박"} 재료 ${expiring.length}개`
      : "임박 재료 없음",
    `보유 ${ownedCount}/${Math.max(ownedCount, totalCount)}`,
    missingCount > 0 ? `추가 ${missingCount}개` : "추가 구매 없음",
  ];

  if (expiring.length > 0) {
    const names = expiring
      .slice(0, 2)
      .map((ingredient) => ingredient.name)
      .join(" · ");
    return { badges, rationale: `${names}부터 쓰기 좋은 요리예요.` };
  }

  if (missingCount === 0) {
    return { badges, rationale: "보관 중인 재료만으로 만들 수 있어요." };
  }

  return {
    badges,
    rationale: `보유 재료 ${ownedCount}개를 중심으로 만들어요.`,
  };
}
