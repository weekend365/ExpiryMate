import {
  ItemStatus,
  UnitCode,
  type InventoryItem,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import type { StepFlowStep } from "../../components/StepFlow";

export type ConsumptionMode = "skip" | "recommended" | "full" | "half" | "custom";

export type ConsumptionChoice = {
  mode: ConsumptionMode;
  amountBase: number;
};

export type ConsumableIngredient = {
  inventoryItemId: string;
  name: string;
  item: InventoryItem;
  recommendedAmountBase: number | null;
};

export function buildCookingSteps(dish: RecipeRecommendationDish): StepFlowStep[] {
  return [
    {
      key: "prep",
      label: "재료 준비",
      title: `${dish.title} 재료를 챙길까요?`,
    },
    ...dish.steps.map((_, index) => ({
      key: `cook-${index}`,
      label: `조리 ${index + 1}단계`,
      title: "한 단계씩 같이 해볼게요",
    })),
    {
      key: "inventory",
      label: "재고 반영",
      title: "얼마나 사용했나요?",
    },
  ];
}

export function resolveConsumableIngredients(
  dish: RecipeRecommendationDish,
  inventory: InventoryItem[],
): ConsumableIngredient[] {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const seen = new Set<string>();

  return dish.usedIngredients.flatMap((ingredient) => {
    const id = ingredient.inventoryItemId;
    if (!id || seen.has(id)) {
      return [];
    }

    const item = inventoryById.get(id);
    if (!item || item.status !== ItemStatus.ACTIVE || item.quantityBase <= 0) {
      return [];
    }

    seen.add(id);
    const recommendedAmountBase =
      ingredient.amount &&
      ingredient.unitCode === item.unitCode &&
      ingredient.amount <= item.quantityBase
        ? ingredient.amount
        : null;

    return [
      {
        inventoryItemId: id,
        name: ingredient.name,
        item,
        recommendedAmountBase,
      },
    ];
  });
}

export function buildDefaultConsumptionChoices(
  ingredients: ConsumableIngredient[],
): Record<string, ConsumptionChoice> {
  return Object.fromEntries(
    ingredients.map((ingredient) => {
      const recommended = ingredient.recommendedAmountBase;
      return [
        ingredient.inventoryItemId,
        recommended
          ? {
              mode: "recommended" as const,
              amountBase: recommended,
            }
          : {
              mode: "skip" as const,
              amountBase: 0,
            },
      ];
    }),
  );
}

export function resolveConsumptionAmount(
  mode: ConsumptionMode,
  available: number,
  recommendedAmountBase: number | null,
): number {
  if (mode === "skip" || available <= 0) {
    return 0;
  }
  if (mode === "full") {
    return available;
  }
  if (mode === "half") {
    return Math.max(1, Math.floor(available / 2));
  }
  if (mode === "recommended" && recommendedAmountBase) {
    return Math.min(recommendedAmountBase, available);
  }
  return Math.max(
    1,
    Math.min(recommendedAmountBase ?? Math.ceil(available / 2), available),
  );
}

export function buildBatchConsumeItems(
  ingredients: ConsumableIngredient[],
  choices: Record<string, ConsumptionChoice>,
) {
  return ingredients.flatMap((ingredient) => {
    const choice = choices[ingredient.inventoryItemId];
    if (!choice || choice.mode === "skip" || choice.amountBase <= 0) {
      return [];
    }

    return [
      {
        inventoryItemId: ingredient.inventoryItemId,
        amountBase: Math.min(choice.amountBase, ingredient.item.quantityBase),
      },
    ];
  });
}

export function hasSelectedConsumption(
  choices: Record<string, ConsumptionChoice>,
) {
  return Object.values(choices).some(
    (choice) => choice.mode !== "skip" && choice.amountBase > 0,
  );
}

export function getCookingGuideMessage(
  currentIndex: number,
  cookingStepCount: number,
) {
  if (currentIndex === 0) {
    return "준비한 재료를 하나씩 눌러 주세요.";
  }
  if (currentIndex > cookingStepCount) {
    return "실제로 쓴 양만큼 냉장고에서 정리해 둘게요.";
  }
  return "카드를 누르면 이 단계를 마친 것으로 표시할게요.";
}

export function unitLabel(unitCode: UnitCode) {
  if (unitCode === UnitCode.ML) {
    return "ml";
  }
  if (unitCode === UnitCode.G) {
    return "g";
  }
  return "개";
}
