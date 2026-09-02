import {
  formatBaseQuantity,
  type RecipeInventorySnapshotItem,
  type RecipeRecommendationDish,
} from "@expirymate/shared";

export const EXPIRING_DAYS_THRESHOLD = 7;

export type HighlightIngredient = {
  key: string;
  name: string;
  amountLabel: string | null;
  daysUntilExpiry: number | null;
  isExpiring: boolean;
};

export type RecipeCardSignal = {
  label: string;
  tone: "primary" | "success" | "warning" | "neutral";
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

export function formatCompactDishMeta(dish: RecipeRecommendationDish) {
  return `${dish.cookingTimeMinutes}분 · ${dish.servings}인분 · ${difficultyLabels[dish.difficulty]}`;
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

export function getRecipeCardSignals(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
): RecipeCardSignal[] {
  const { expiring, ownedCount, missingCount } =
    getRecipeDecisionContext(dish, inventorySnapshot);
  const firstExpiring = expiring[0];
  const signals: RecipeCardSignal[] = [];

  if (firstExpiring) {
    const expiryLabel =
      formatIngredientDdayLabel(firstExpiring.daysUntilExpiry) ?? "임박";
    signals.push({
      label: `${expiryLabel} ${withObjectParticle(firstExpiring.name)} 먼저`,
      tone: "warning",
    });
  } else if (missingCount > 0) {
    signals.push({ label: `보유 재료 ${ownedCount}개`, tone: "primary" });
  } else {
    signals.push({ label: `보유 재료 ${ownedCount}개`, tone: "primary" });
  }

  if (missingCount === 0) {
    signals.push({ label: "추가 재료 없음", tone: "success" });
  } else {
    signals.push({
      label: `추가 재료 ${missingCount}개`,
      tone: "neutral",
    });
  }

  return signals.slice(0, 2);
}

function withObjectParticle(value: string) {
  const lastCharacter = value.at(-1);
  if (!lastCharacter) return value;

  const syllableIndex = lastCharacter.charCodeAt(0) - 0xac00;
  const isHangulSyllable = syllableIndex >= 0 && syllableIndex <= 0x2ba3;
  const hasFinalConsonant = isHangulSyllable && syllableIndex % 28 !== 0;

  return `${value}${hasFinalConsonant ? "을" : "를"}`;
}

function getRecipeDecisionContext(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
) {
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

  return {
    expiring,
    ownedCount,
    missingCount,
  };
}
