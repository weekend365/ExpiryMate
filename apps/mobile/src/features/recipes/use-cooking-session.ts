import { formatBaseQuantity, type InventoryItem } from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBatchConsumeInventoryItems } from "../inventory/use-batch-consume-inventory-items";
import { useInventoryList } from "../inventory/use-inventory-list";
import {
  buildBatchConsumeItems,
  buildCookingSteps,
  buildDefaultConsumptionChoices,
  remainingPrepCount,
  resolveConsumableIngredients,
  type ConsumptionChoice,
} from "./cooking";
import { useRecipeRecommendation } from "./use-recipe-recommendation";
import {
  getRecipeFavoriteKey,
  useRecipeFavorites,
  useRecipeEngagement,
  useSetRecipeFavorite,
} from "./use-recipe-recommendations";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function useCookingSession() {
  const params = useLocalSearchParams<{
    recommendationId?: string | string[];
    dishIndex?: string | string[];
  }>();
  const recommendationId = firstParam(params.recommendationId);
  const requestedDishIndex = Number.parseInt(
    firstParam(params.dishIndex) ?? "0",
    10,
  );
  const recommendationQuery = useRecipeRecommendation(recommendationId);
  const inventoryQuery = useInventoryList();
  const consumeMutation = useBatchConsumeInventoryItems();
  const favoritesQuery = useRecipeFavorites();
  const setFavoriteMutation = useSetRecipeFavorite();
  const engagementMutation = useRecipeEngagement();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [checkedPrepKeys, setCheckedPrepKeys] = useState<string[]>([]);
  const [completedCookingSteps, setCompletedCookingSteps] = useState<number[]>(
    [],
  );
  const [consumptionChoices, setConsumptionChoices] = useState<
    Record<string, ConsumptionChoice>
  >({});
  const [updatedItems, setUpdatedItems] = useState<InventoryItem[] | null>(
    null,
  );

  const recommendation = recommendationQuery.data;
  const dish =
    Number.isInteger(requestedDishIndex) && requestedDishIndex >= 0
      ? recommendation?.recommendations[requestedDishIndex]
      : undefined;
  const steps = useMemo(() => (dish ? buildCookingSteps(dish) : []), [dish]);
  const consumptionStepIndex = dish ? dish.steps.length + 1 : -1;
  const cookingStepIndex =
    currentIndex > 0 && currentIndex < consumptionStepIndex
      ? currentIndex - 1
      : null;
  const prepRows = useMemo(
    () =>
      dish?.usedIngredients.map((ingredient, index) => ({
        key:
          ingredient.inventoryItemId ??
          `${ingredient.name}-${requestedDishIndex}-${index}`,
        name: ingredient.name,
        amountLabel:
          ingredient.amount && ingredient.unitCode
            ? formatBaseQuantity(ingredient.amount, ingredient.unitCode)
            : null,
      })) ?? [],
    [dish, requestedDishIndex],
  );
  const consumableIngredients = useMemo(
    () =>
      dish ? resolveConsumableIngredients(dish, inventoryQuery.data ?? []) : [],
    [dish, inventoryQuery.data],
  );
  const isFavorite = Boolean(
    recommendationId &&
      favoritesQuery.data?.some(
        (favorite) =>
          getRecipeFavoriteKey(
            favorite.sourceRecommendationId,
            favorite.sourceDishIndex,
          ) === getRecipeFavoriteKey(recommendationId, requestedDishIndex),
      ),
  );

  useEffect(() => {
    if (!consumableIngredients.length) {
      return;
    }

    setConsumptionChoices((current) => {
      if (Object.keys(current).length > 0) {
        return current;
      }
      return buildDefaultConsumptionChoices(consumableIngredients);
    });
  }, [consumableIngredients]);

  const leaveCooking = useCallback(() => {
    if (updatedItems || !router.canGoBack()) {
      router.replace("/(tabs)/recommendations");
      return;
    }

    router.back();
  }, [updatedItems]);

  const goToPreviousStep = useCallback(() => {
    if (updatedItems || currentIndex === 0) {
      leaveCooking();
      return;
    }

    setCurrentIndex((index) => Math.max(0, index - 1));
  }, [currentIndex, leaveCooking, updatedItems]);

  const goForward = useCallback(() => {
    if (
      currentIndex === 0 &&
      recommendationId &&
      Number.isInteger(requestedDishIndex)
    ) {
      engagementMutation.mutate({
        recommendationId,
        dishIndex: requestedDishIndex,
        action: "cooking_started",
      });
    }
    setCurrentIndex((index) => Math.min(consumptionStepIndex, index + 1));
  }, [
    consumptionStepIndex,
    currentIndex,
    engagementMutation,
    recommendationId,
    requestedDishIndex,
  ]);

  const toggleCookingStep = useCallback((stepIndex: number) => {
    setCompletedCookingSteps((current) =>
      current.includes(stepIndex)
        ? current.filter((index) => index !== stepIndex)
        : [...current, stepIndex],
    );
  }, []);

  const completeCookingStepAndAdvance = useCallback(() => {
    if (!dish || cookingStepIndex === null) {
      return;
    }
    setCompletedCookingSteps((current) =>
      current.includes(cookingStepIndex)
        ? current
        : [...current, cookingStepIndex],
    );
    if (cookingStepIndex === dish.steps.length - 1 && recommendationId) {
      engagementMutation.mutate({
        recommendationId,
        dishIndex: requestedDishIndex,
        action: "cooking_completed",
      });
    }
    goForward();
  }, [
    cookingStepIndex,
    dish,
    engagementMutation,
    goForward,
    recommendationId,
    requestedDishIndex,
  ]);

  const handleApplyInventory = useCallback(async () => {
    const items = buildBatchConsumeItems(
      consumableIngredients,
      consumptionChoices,
    );

    if (!items.length) {
      setUpdatedItems([]);
      return;
    }

    const result = await consumeMutation.mutateAsync({ items });
    setUpdatedItems(result.items);
  }, [consumableIngredients, consumeMutation, consumptionChoices]);

  const handleToggleFavorite = useCallback(() => {
    if (!recommendationId || !dish) {
      return;
    }

    setFavoriteMutation.mutate({
      recommendationId,
      dishIndex: requestedDishIndex,
      dish,
      inventorySnapshot: recommendation?.inventorySnapshot ?? [],
      favorite: !isFavorite,
    });
  }, [
    dish,
    isFavorite,
    recommendation?.inventorySnapshot,
    recommendationId,
    requestedDishIndex,
    setFavoriteMutation,
  ]);

  const checkedPrepKeySet = new Set(checkedPrepKeys);
  const uncheckedPrepCount = remainingPrepCount(
    checkedPrepKeys.length,
    prepRows.length,
  );
  const cookingStepCompleted =
    cookingStepIndex !== null &&
    completedCookingSteps.includes(cookingStepIndex);
  const mutationError =
    consumeMutation.error instanceof Error
      ? consumeMutation.error.message
      : null;
  const favoriteMutationError =
    setFavoriteMutation.error instanceof Error
      ? setFavoriteMutation.error.message
      : null;

  return {
    recommendationId,
    requestedDishIndex,
    recommendationQuery,
    inventoryQuery,
    consumeMutation,
    setFavoriteMutation,
    currentIndex,
    checkedPrepKeys,
    setCheckedPrepKeys,
    consumptionChoices,
    setConsumptionChoices,
    updatedItems,
    dish,
    steps,
    consumptionStepIndex,
    cookingStepIndex,
    prepRows,
    consumableIngredients,
    isFavorite,
    goToPreviousStep,
    goForward,
    toggleCookingStep,
    completeCookingStepAndAdvance,
    handleApplyInventory,
    handleToggleFavorite,
    checkedPrepKeySet,
    uncheckedPrepCount,
    cookingStepCompleted,
    mutationError,
    favoriteMutationError,
  };
}
