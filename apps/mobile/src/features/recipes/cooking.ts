import {
  ItemStatus,
  UnitCode,
  applyConsumedAmountToInventoryItem,
  type InventoryItem,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import type { StepFlowStep } from "../../components/StepFlow";

type RecipeUsedIngredient = RecipeRecommendationDish["usedIngredients"][number];

export type ConsumptionMode = "skip" | "recommended" | "full" | "half" | "custom";
export type IngredientMatchStatus = "matched" | "multiple" | "unmatched";

export type ConsumptionChoice = {
  mode: ConsumptionMode;
  amountBase: number;
  selectedInventoryItemId: string | null;
};

export type ConsumableIngredient = {
  key: string;
  name: string;
  recipeAmount: number | null;
  recipeUnitCode: UnitCode | null;
  inventoryItemId: string | null;
  item: InventoryItem | null;
  candidates: InventoryItem[];
  matchStatus: IngredientMatchStatus;
  recommendedAmountBase: number | null;
};

const COOKING_NAME_ALIASES: Record<string, string> = {
  계란: "계란",
  달걀: "계란",
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
      title:
        index === dish.steps.length - 1
          ? "요리가 거의 완성됐어요"
          : "한 단계씩 같이 해볼게요",
    })),
    {
      key: "complete",
      label: "요리 완성",
      title: "맛있게 완성됐어요",
    },
    {
      key: "inventory",
      label: "재고 반영",
      title: "사용한 재료를 보관함에 반영할까요?",
    },
  ];
}

const MIN_TOKEN_MATCH_LENGTH = 2;

export function normalizeCookingName(value: string) {
  const normalized = value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
  return COOKING_NAME_ALIASES[normalized] ?? normalized;
}

export function cookingNameTokens(value: string) {
  return value
    .split(/[\s,/·]+/)
    .map((part) => normalizeCookingName(part))
    .filter((part) => part.length > 0);
}

export function cookingNamesMatch(
  recipeName: string,
  displayName: string,
): "exact" | "token" | null {
  const recipe = normalizeCookingName(recipeName);
  if (!recipe) {
    return null;
  }
  if (normalizeCookingName(displayName) === recipe) {
    return "exact";
  }
  if (
    recipe.length >= MIN_TOKEN_MATCH_LENGTH &&
    cookingNameTokens(displayName).includes(recipe)
  ) {
    return "token";
  }
  return null;
}

export function convertRecipeAmountToInventoryBase(
  recipeAmount: number,
  recipeUnitCode: UnitCode,
  itemUnitCode: UnitCode,
) {
  if (!Number.isFinite(recipeAmount) || recipeAmount <= 0) {
    return null;
  }
  if (recipeUnitCode !== itemUnitCode) {
    return null;
  }
  return Math.floor(recipeAmount);
}

export function remainingQuantityBase(available: number, consumeAmount: number) {
  return Math.max(0, available - Math.min(Math.max(0, consumeAmount), available));
}

export function getCookingStepCta(isLastCookingStep: boolean) {
  return isLastCookingStep ? "요리했어요" : "이 단계까지 했어요";
}

export function getInventoryApplyCta(
  hasSelection: boolean,
  isEditing = false,
) {
  if (!hasSelection) {
    return "재고는 그대로 둘게요";
  }
  return isEditing ? "수정한 사용량으로 반영" : "추천 사용량으로 반영";
}

function isActiveInventoryItem(item: InventoryItem | undefined): item is InventoryItem {
  return Boolean(item && item.status === ItemStatus.ACTIVE && item.quantityBase > 0);
}

function collectNameCandidates(items: InventoryItem[], recipeName: string) {
  const exact: InventoryItem[] = [];
  const token: InventoryItem[] = [];

  for (const item of items) {
    const kind = cookingNamesMatch(recipeName, item.displayName);
    if (kind === "exact") {
      exact.push(item);
    } else if (kind === "token") {
      token.push(item);
    }
  }

  return exact.length > 0 ? exact : token;
}

function ingredientKey(ingredient: RecipeUsedIngredient, index: number) {
  return ingredient.inventoryItemId ?? `recipe:${index}:${ingredient.name}`;
}

export function recommendedAmountForInventoryItem(
  recipeAmount: number | null | undefined,
  recipeUnitCode: UnitCode | null | undefined,
  item: InventoryItem,
) {
  if (!recipeAmount || !recipeUnitCode) {
    return null;
  }

  const converted = convertRecipeAmountToInventoryBase(
    recipeAmount,
    recipeUnitCode,
    item.unitCode,
  );
  if (converted == null) {
    return null;
  }

  return Math.min(converted, item.quantityBase);
}

function recipeAmountOf(ingredient: RecipeUsedIngredient) {
  return ingredient.amount ?? null;
}

function recipeUnitOf(ingredient: RecipeUsedIngredient) {
  return ingredient.unitCode ?? null;
}

function withMatchedItem(
  ingredient: RecipeUsedIngredient,
  index: number,
  item: InventoryItem,
): ConsumableIngredient {
  return {
    key: ingredientKey(ingredient, index),
    name: ingredient.name,
    recipeAmount: recipeAmountOf(ingredient),
    recipeUnitCode: recipeUnitOf(ingredient),
    inventoryItemId: item.id,
    item,
    candidates: [item],
    matchStatus: "matched",
    recommendedAmountBase: recommendedAmountForInventoryItem(
      ingredient.amount,
      ingredient.unitCode,
      item,
    ),
  };
}

export function resolveConsumableIngredients(
  dish: RecipeRecommendationDish,
  inventory: InventoryItem[],
): ConsumableIngredient[] {
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const usedIds = new Set<string>();

  const idMatched = dish.usedIngredients.map((ingredient, index) => {
    const linked = ingredient.inventoryItemId
      ? inventoryById.get(ingredient.inventoryItemId)
      : undefined;
    if (!isActiveInventoryItem(linked) || usedIds.has(linked.id)) {
      return null;
    }

    usedIds.add(linked.id);
    return withMatchedItem(ingredient, index, linked);
  });

  const unusedActive = inventory.filter(
    (item) => isActiveInventoryItem(item) && !usedIds.has(item.id),
  );

  return dish.usedIngredients.map((ingredient, index) => {
    const matched = idMatched[index];
    if (matched) {
      return matched;
    }

    const candidates = collectNameCandidates(
      unusedActive.filter((item) => !usedIds.has(item.id)),
      ingredient.name,
    );

    if (candidates.length === 1) {
      const item = candidates[0];
      if (item) {
        usedIds.add(item.id);
        return withMatchedItem(ingredient, index, item);
      }
    }

    if (candidates.length > 1) {
      return {
        key: ingredientKey(ingredient, index),
        name: ingredient.name,
        recipeAmount: recipeAmountOf(ingredient),
        recipeUnitCode: recipeUnitOf(ingredient),
        inventoryItemId: null,
        item: null,
        candidates,
        matchStatus: "multiple" as const,
        recommendedAmountBase: null,
      };
    }

    return {
      key: ingredientKey(ingredient, index),
      name: ingredient.name,
      recipeAmount: recipeAmountOf(ingredient),
      recipeUnitCode: recipeUnitOf(ingredient),
      inventoryItemId: null,
      item: null,
      candidates: [],
      matchStatus: "unmatched" as const,
      recommendedAmountBase: null,
    };
  });
}

export function defaultConsumptionChoice(
  ingredient: ConsumableIngredient,
): ConsumptionChoice {
  const recommended = ingredient.recommendedAmountBase;
  const selectedInventoryItemId = ingredient.inventoryItemId;

  if (ingredient.matchStatus === "matched" && recommended) {
    return {
      mode: "recommended",
      amountBase: recommended,
      selectedInventoryItemId,
    };
  }

  return {
    mode: "skip",
    amountBase: 0,
    selectedInventoryItemId:
      ingredient.matchStatus === "matched" ? selectedInventoryItemId : null,
  };
}

export function buildDefaultConsumptionChoices(
  ingredients: ConsumableIngredient[],
): Record<string, ConsumptionChoice> {
  return Object.fromEntries(
    ingredients.map((ingredient) => [
      ingredient.key,
      defaultConsumptionChoice(ingredient),
    ]),
  );
}

export function resolveSelectedInventoryItem(
  ingredient: ConsumableIngredient,
  choice: ConsumptionChoice | undefined,
) {
  const selectedId =
    choice?.selectedInventoryItemId ?? ingredient.inventoryItemId;
  if (!selectedId) {
    return null;
  }
  if (ingredient.item?.id === selectedId) {
    return ingredient.item;
  }
  return ingredient.candidates.find((item) => item.id === selectedId) ?? null;
}

export function reconcileConsumptionChoices(
  ingredients: ConsumableIngredient[],
  storedChoices: Record<string, ConsumptionChoice>,
) {
  return Object.fromEntries(
    ingredients.map((ingredient) => {
      const fallback = defaultConsumptionChoice(ingredient);
      const stored = storedChoices[ingredient.key];
      if (!stored || ingredient.matchStatus === "unmatched") {
        return [ingredient.key, fallback];
      }

      const selected = resolveSelectedInventoryItem(ingredient, stored);
      if (!selected) {
        return [ingredient.key, fallback];
      }

      return [
        ingredient.key,
        {
          ...stored,
          amountBase:
            stored.mode === "skip"
              ? 0
              : Math.min(stored.amountBase, selected.quantityBase),
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
  const seen = new Set<string>();

  return ingredients.flatMap((ingredient) => {
    const choice = choices[ingredient.key];
    const item = resolveSelectedInventoryItem(ingredient, choice);
    if (!choice || !item || choice.mode === "skip" || choice.amountBase <= 0) {
      return [];
    }
    if (seen.has(item.id)) {
      return [];
    }

    seen.add(item.id);
    return [
      {
        inventoryItemId: item.id,
        amountBase: Math.min(choice.amountBase, item.quantityBase),
      },
    ];
  });
}

export function buildOptimisticConsumedItems(
  ingredients: ConsumableIngredient[],
  choices: Record<string, ConsumptionChoice>,
): InventoryItem[] {
  const payload = buildBatchConsumeItems(ingredients, choices);

  return payload.flatMap((entry) => {
    const ingredient = ingredients.find((candidate) => {
      const selected = resolveSelectedInventoryItem(
        candidate,
        choices[candidate.key],
      );
      return selected?.id === entry.inventoryItemId;
    });
    const original = ingredient
      ? resolveSelectedInventoryItem(ingredient, choices[ingredient.key])
      : null;
    if (!original) {
      return [];
    }

    const next = applyConsumedAmountToInventoryItem(original, entry.amountBase);
    return [
      {
        ...next,
        status:
          next.quantityBase <= 0 ? ItemStatus.CONSUMED : original.status,
      },
    ];
  });
}

export function listDepletedShoppingTargets(
  updatedItems: InventoryItem[],
  ingredients: ConsumableIngredient[],
  alreadyListedNames: string[],
  alreadyOpenedKeys: string[],
) {
  const listedKeys = new Set(
    alreadyListedNames.map((name) => normalizeCookingName(name)).filter(Boolean),
  );
  const openedKeys = new Set(alreadyOpenedKeys);
  const seen = new Set<string>();

  return updatedItems.flatMap((item) => {
    if (item.status !== ItemStatus.CONSUMED && item.quantityBase > 0) {
      return [];
    }

    const ingredient = ingredients.find(
      (candidate) =>
        candidate.key === item.id ||
        candidate.inventoryItemId === item.id ||
        candidate.item?.id === item.id ||
        candidate.candidates.some((entry) => entry.id === item.id),
    );
    const searchName = ingredient?.name ?? item.displayName;
    const key = normalizeCookingName(searchName);
    if (!key || seen.has(key) || listedKeys.has(key) || openedKeys.has(key)) {
      return [];
    }

    seen.add(key);
    return [
      {
        itemId: item.id,
        label: searchName,
        searchName,
        key,
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

export function remainingPrepCount(checkedCount: number, totalCount: number) {
  return Math.max(0, totalCount - checkedCount);
}

export function getPrepContinueCta(uncheckedCount: number) {
  if (uncheckedCount <= 0) {
    return "재료가 준비됐어요";
  }
  if (uncheckedCount === 1) {
    return "이 재료 빼고 시작할게요";
  }
  return `${uncheckedCount}개는 빼고 시작할게요`;
}

export function getCookingGuideMessage(
  currentIndex: number,
  cookingStepCount: number,
  uncheckedPrepCount = 0,
) {
  if (currentIndex === 0) {
    if (uncheckedPrepCount > 0) {
      return uncheckedPrepCount === 1
        ? "1개가 아직이에요. 없어도 조리를 이어갈 수 있어요."
        : `${uncheckedPrepCount}개가 아직이에요. 없어도 조리를 이어갈 수 있어요.`;
    }
    return "준비한 재료를 하나씩 눌러 주세요.";
  }
  if (currentIndex === cookingStepCount + 1) {
    return "완성된 요리를 즐긴 뒤 재고 정리는 따로 이어갈 수 있어요.";
  }
  if (currentIndex > cookingStepCount + 1) {
    return "실제로 사용한 양이 다르면 수정할 수 있어요.";
  }
  if (currentIndex === cookingStepCount) {
    return "요리가 거의 완성됐어요.";
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
