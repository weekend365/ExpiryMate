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
  getCookingGuideMessage,
  getCookingStepCta,
  getInventoryApplyCta,
  getPrepContinueCta,
  remainingPrepCount,
  remainingQuantityBase,
  reconcileConsumptionChoices,
  resolveConsumableIngredients,
  resolveConsumptionAmount,
  cookingNamesMatch,
  convertRecipeAmountToInventoryBase,
  buildOptimisticConsumedItems,
  listDepletedShoppingTargets,
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

function item(
  overrides: Partial<InventoryItem> & Pick<InventoryItem, "id" | "displayName">,
): InventoryItem {
  return {
    ...milk,
    quantity: 1,
    unit: "개",
    quantityBase: 1,
    unitCode: UnitCode.EA,
    ...overrides,
  };
}

describe("cooking flow helpers", () => {
  it("builds prep, cook, and inventory steps", () => {
    const steps = buildCookingSteps(dish);
    expect(steps.map((step) => step.key)).toEqual([
      "prep",
      "cook-0",
      "cook-1",
      "complete",
      "inventory",
    ]);
    expect(steps[2]?.title).toBe("요리가 거의 완성됐어요");
    expect(steps[3]?.title).toBe("맛있게 완성됐어요");
    expect(steps[4]?.title).toBe("사용한 재료를 보관함에 반영할까요?");
  });

  it("keeps active inventory links and shows unmatched recipe ingredients", () => {
    const ingredients = resolveConsumableIngredients(dish, [
      milk,
      { ...egg, status: ItemStatus.CONSUMED },
    ]);

    expect(ingredients.map((entry) => [entry.name, entry.matchStatus])).toEqual([
      ["우유", "matched"],
      ["계란", "unmatched"],
      ["소금", "unmatched"],
    ]);
    expect(ingredients[0]?.inventoryItemId).toBe("milk-1");
    expect(ingredients[0]?.recommendedAmountBase).toBe(500);
  });

  it("defaults to recommended amounts when available", () => {
    const ingredients = resolveConsumableIngredients(dish, [milk, egg]);
    const choices = buildDefaultConsumptionChoices(ingredients);

    expect(choices["milk-1"]).toEqual({
      mode: "recommended",
      amountBase: 500,
      selectedInventoryItemId: "milk-1",
    });
    expect(choices["egg-1"]).toEqual({
      mode: "recommended",
      amountBase: 2,
      selectedInventoryItemId: "egg-1",
    });
    expect(choices["recipe:2:소금"]?.mode).toBe("skip");
  });

  it("restores offline consumption choices after live inventory arrives", () => {
    const ingredients = resolveConsumableIngredients(dish, [milk, egg]);
    const choices = reconcileConsumptionChoices(ingredients, {
      "milk-1": {
        mode: "custom",
        amountBase: 2_000,
        selectedInventoryItemId: "milk-1",
      },
      "egg-1": {
        mode: "half",
        amountBase: 5,
        selectedInventoryItemId: "removed-item",
      },
      removed: {
        mode: "full",
        amountBase: 1,
        selectedInventoryItemId: "removed-item",
      },
    });

    expect(choices["milk-1"]).toEqual({
      mode: "custom",
      amountBase: 1_000,
      selectedInventoryItemId: "milk-1",
    });
    expect(choices["egg-1"]).toEqual({
      mode: "recommended",
      amountBase: 2,
      selectedInventoryItemId: "egg-1",
    });
    expect(choices.removed).toBeUndefined();
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
      "milk-1": {
        mode: "half",
        amountBase: 500,
        selectedInventoryItemId: "milk-1",
      },
      "egg-1": { mode: "skip", amountBase: 0, selectedInventoryItemId: "egg-1" },
    });

    expect(items).toEqual([{ inventoryItemId: "milk-1", amountBase: 500 }]);
  });

  it("lets cooking start without every prep item checked", () => {
    expect(remainingPrepCount(1, 3)).toBe(2);
    expect(getPrepContinueCta(0)).toBe("조리 시작");
    expect(getPrepContinueCta(1)).toBe("이 재료 제외하고 시작");
    expect(getPrepContinueCta(2)).toBe("2개 제외하고 시작");
    expect(getCookingGuideMessage(0, 2, 2)).toBe(
      "2개가 아직이에요. 없어도 조리를 이어갈 수 있어요.",
    );
    expect(getCookingGuideMessage(0, 2, 0)).toBe(
      "준비한 재료를 하나씩 눌러 주세요.",
    );
  });

  it("labels the final cooking action explicitly", () => {
    expect(getCookingStepCta(false)).toBe("단계 완료");
    expect(getCookingStepCta(true)).toBe("요리 완료");
    expect(getCookingGuideMessage(1, 2)).toBe(
      "카드를 누르면 이 단계를 마친 것으로 표시할게요.",
    );
    expect(getCookingGuideMessage(2, 2)).toBe("요리가 거의 완성됐어요.");
    expect(getCookingGuideMessage(3, 2)).toBe(
      "완성된 요리를 즐긴 뒤 재고 정리는 따로 이어갈 수 있어요.",
    );
    expect(getCookingGuideMessage(4, 2)).toBe(
      "실제로 사용한 양이 다르면 수정할 수 있어요.",
    );
    expect(getInventoryApplyCta(true)).toBe("추천 사용량으로 반영");
    expect(getInventoryApplyCta(true, true)).toBe("수정한 사용량으로 반영");
    expect(getInventoryApplyCta(false)).toBe("재고 반영 안 함");
  });

  it("previews remaining egg and milk quantities", () => {
    const ingredients = resolveConsumableIngredients(dish, [milk, egg]);
    const eggRow = ingredients.find((entry) => entry.key === "egg-1");
    const milkRow = ingredients.find((entry) => entry.key === "milk-1");

    expect(eggRow?.item?.quantityBase).toBe(10);
    expect(eggRow?.recommendedAmountBase).toBe(2);
    expect(remainingQuantityBase(10, 2)).toBe(8);
    expect(remainingQuantityBase(1000, 200)).toBe(800);
    expect(milkRow?.recommendedAmountBase).toBe(500);
  });

  it("consumes the last piece of tofu down to zero", () => {
    const tofuDish: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: "tofu-1",
          name: "두부",
          amount: 1,
          unitCode: UnitCode.EA,
        },
      ],
    };
    const tofu = item({
      id: "tofu-1",
      displayName: "두부",
      quantityBase: 1,
    });
    const ingredients = resolveConsumableIngredients(tofuDish, [tofu]);
    const choices = buildDefaultConsumptionChoices(ingredients);

    expect(choices["tofu-1"]?.amountBase).toBe(1);
    expect(remainingQuantityBase(1, 1)).toBe(0);
    expect(buildBatchConsumeItems(ingredients, choices)).toEqual([
      { inventoryItemId: "tofu-1", amountBase: 1 },
    ]);
  });

  it("clamps recommended usage when stock is lower than the recipe", () => {
    const shortEgg: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: "egg-1",
          name: "계란",
          amount: 2,
          unitCode: UnitCode.EA,
        },
      ],
    };
    const ingredients = resolveConsumableIngredients(shortEgg, [
      { ...egg, quantityBase: 1 },
    ]);
    const choices = buildDefaultConsumptionChoices(ingredients);

    expect(ingredients[0]?.recommendedAmountBase).toBe(1);
    expect(choices["egg-1"]?.amountBase).toBe(1);
    expect(buildBatchConsumeItems(ingredients, choices)).toEqual([
      { inventoryItemId: "egg-1", amountBase: 1 },
    ]);
  });

  it("marks missing recipe ingredients as unmatched", () => {
    const avocadoDish: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: null,
          name: "아보카도",
          amount: 1,
          unitCode: UnitCode.EA,
        },
      ],
    };
    const ingredients = resolveConsumableIngredients(avocadoDish, [milk, egg]);

    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.matchStatus).toBe("unmatched");
    expect(buildBatchConsumeItems(ingredients, buildDefaultConsumptionChoices(ingredients))).toEqual(
      [],
    );
  });

  it("does not auto-select when two inventory items share the same name", () => {
    const milkDish: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: null,
          name: "우유",
          amount: 200,
          unitCode: UnitCode.ML,
        },
      ],
    };
    const ingredients = resolveConsumableIngredients(milkDish, [
      item({
        id: "milk-plain",
        displayName: "우유",
        quantityBase: 1000,
        unitCode: UnitCode.ML,
      }),
      item({
        id: "milk-light",
        displayName: "우유",
        quantityBase: 500,
        unitCode: UnitCode.ML,
      }),
    ]);

    expect(ingredients[0]?.matchStatus).toBe("multiple");
    expect(ingredients[0]?.inventoryItemId).toBeNull();
    expect(ingredients[0]?.candidates).toHaveLength(2);
    expect(buildDefaultConsumptionChoices(ingredients)[ingredients[0]?.key ?? ""]?.mode).toBe(
      "skip",
    );
  });

  it("matches a unique alias when the linked inventory id is gone", () => {
    const eggDish: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: null,
          name: "계란",
          amount: 2,
          unitCode: UnitCode.EA,
        },
      ],
    };
    const ingredients = resolveConsumableIngredients(eggDish, [
      item({
        id: "egg-alias",
        displayName: "달걀",
        quantityBase: 10,
      }),
    ]);

    expect(ingredients[0]?.matchStatus).toBe("matched");
    expect(ingredients[0]?.inventoryItemId).toBe("egg-alias");
    expect(ingredients[0]?.recommendedAmountBase).toBe(2);
    expect(remainingQuantityBase(10, 2)).toBe(8);
  });

  it("does not auto-calculate recommended amounts when units differ", () => {
    const ingredients = resolveConsumableIngredients(
      {
        ...dish,
        usedIngredients: [
          {
            inventoryItemId: "milk-1",
            name: "우유",
            amount: 2,
            unitCode: UnitCode.EA,
          },
        ],
      },
      [milk],
    );

    expect(ingredients[0]?.matchStatus).toBe("matched");
    expect(ingredients[0]?.recommendedAmountBase).toBeNull();
    expect(buildDefaultConsumptionChoices(ingredients)["milk-1"]?.mode).toBe(
      "skip",
    );
  });

  it("matches a unique spaced inventory name by token, not short substrings", () => {
    expect(cookingNamesMatch("양파", "국내산 양파")).toBe("token");
    expect(cookingNamesMatch("파", "대파")).toBeNull();
    expect(cookingNamesMatch("대파", "쪽파")).toBeNull();
    expect(convertRecipeAmountToInventoryBase(200, UnitCode.ML, UnitCode.ML)).toBe(
      200,
    );
    expect(convertRecipeAmountToInventoryBase(200, UnitCode.ML, UnitCode.EA)).toBeNull();

    const onionDish: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: null,
          name: "양파",
          amount: 1,
          unitCode: UnitCode.EA,
        },
      ],
    };
    const ingredients = resolveConsumableIngredients(onionDish, [
      item({ id: "onion-1", displayName: "국내산 양파", quantityBase: 3 }),
    ]);

    expect(ingredients[0]?.matchStatus).toBe("matched");
    expect(ingredients[0]?.inventoryItemId).toBe("onion-1");
  });

  it("builds optimistic leftovers and shopping targets for depleted items", () => {
    const tofuDish: RecipeRecommendationDish = {
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: "tofu-1",
          name: "두부",
          amount: 1,
          unitCode: UnitCode.EA,
        },
        {
          inventoryItemId: "milk-1",
          name: "우유",
          amount: 200,
          unitCode: UnitCode.ML,
        },
      ],
    };
    const tofu = item({ id: "tofu-1", displayName: "두부", quantityBase: 1 });
    const ingredients = resolveConsumableIngredients(tofuDish, [tofu, milk]);
    const choices = buildDefaultConsumptionChoices(ingredients);
    const updated = buildOptimisticConsumedItems(ingredients, choices);

    expect(updated).toEqual([
      expect.objectContaining({
        id: "tofu-1",
        quantityBase: 0,
        status: ItemStatus.CONSUMED,
      }),
      expect.objectContaining({
        id: "milk-1",
        quantityBase: 800,
        status: ItemStatus.ACTIVE,
      }),
    ]);
    expect(
      listDepletedShoppingTargets(updated, ingredients, [], []),
    ).toEqual([
      expect.objectContaining({
        itemId: "tofu-1",
        searchName: "두부",
      }),
    ]);
    expect(
      listDepletedShoppingTargets(updated, ingredients, ["두부"], []),
    ).toEqual([]);

    const afterCacheRemoval = resolveConsumableIngredients(tofuDish, []);
    expect(
      listDepletedShoppingTargets(updated, afterCacheRemoval, [], []),
    ).toEqual([
      expect.objectContaining({
        itemId: "tofu-1",
        searchName: "두부",
      }),
    ]);
  });
});
