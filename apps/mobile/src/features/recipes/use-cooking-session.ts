import { formatBaseQuantity, type InventoryItem } from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeferredInventoryItemRemoval } from "../inventory/use-deferred-inventory-item-removal";
import { useInventoryList } from "../inventory/use-inventory-list";
import { useActiveSpace } from "../spaces/space-provider";
import {
  buildBatchConsumeItems,
  buildCookingSteps,
  buildOptimisticConsumedItems,
  defaultConsumptionChoice,
  remainingPrepCount,
  resolveConsumableIngredients,
  resolveSelectedInventoryItem,
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
    stepIndex?: string | string[];
  }>();
  const recommendationId = firstParam(params.recommendationId);
  const requestedDishIndex = Number.parseInt(
    firstParam(params.dishIndex) ?? "0",
    10,
  );
  const requestedStepIndex = Number.parseInt(
    firstParam(params.stepIndex) ?? "",
    10,
  );
  const recommendationQuery = useRecipeRecommendation(recommendationId);
  const inventoryQuery = useInventoryList();
  const { activeSpaceId } = useActiveSpace();
  const {
    scheduleRemoval,
    undoRemoval,
    undoLabel,
    errorMessage,
    isPending: inventoryApplyPending,
    clearError,
  } = useDeferredInventoryItemRemoval();
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
  const [openedShoppingKeys, setOpenedShoppingKeys] = useState<string[]>([]);
  const cookingCompletedRecorded = useRef(false);
  const appliedStepRouteRef = useRef<string | null>(null);

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
    if (
      !dish ||
      !Number.isInteger(requestedStepIndex) ||
      requestedStepIndex < 0 ||
      requestedStepIndex >= dish.steps.length
    ) {
      return;
    }
    const routeKey = `${recommendationId}:${requestedDishIndex}:${requestedStepIndex}`;
    if (appliedStepRouteRef.current === routeKey) {
      return;
    }
    appliedStepRouteRef.current = routeKey;
    setCurrentIndex(requestedStepIndex + 1);
  }, [dish, recommendationId, requestedDishIndex, requestedStepIndex]);

  useEffect(() => {
    if (inventoryQuery.isPending) {
      return;
    }

    setConsumptionChoices((current) => {
      let changed = false;
      const next = { ...current };

      for (const ingredient of consumableIngredients) {
        const existing = next[ingredient.key];
        if (!existing) {
          next[ingredient.key] = defaultConsumptionChoice(ingredient);
          changed = true;
          continue;
        }

        if (
          ingredient.matchStatus === "matched" &&
          !existing.selectedInventoryItemId &&
          ingredient.inventoryItemId
        ) {
          next[ingredient.key] = defaultConsumptionChoice(ingredient);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [consumableIngredients, inventoryQuery.isPending]);

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
    if (
      cookingStepIndex === dish.steps.length - 1 &&
      recommendationId &&
      !cookingCompletedRecorded.current
    ) {
      cookingCompletedRecorded.current = true;
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

  const handleApplyInventory = useCallback(() => {
    if (inventoryApplyPending || updatedItems !== null) {
      return;
    }

    const items = buildBatchConsumeItems(
      consumableIngredients,
      consumptionChoices,
    );

    if (!items.length) {
      setUpdatedItems([]);
      return;
    }

    if (!activeSpaceId) {
      return;
    }

    clearError();

    for (const entry of items) {
      const ingredient = consumableIngredients.find((candidate) => {
        const selected = resolveSelectedInventoryItem(
          candidate,
          consumptionChoices[candidate.key],
        );
        return selected?.id === entry.inventoryItemId;
      });
      const original = ingredient
        ? resolveSelectedInventoryItem(
            ingredient,
            consumptionChoices[ingredient.key],
          )
        : null;
      if (!original) {
        continue;
      }
      scheduleRemoval(original, "consume", entry.amountBase);
    }

    setUpdatedItems(
      buildOptimisticConsumedItems(consumableIngredients, consumptionChoices),
    );
  }, [
    activeSpaceId,
    clearError,
    consumableIngredients,
    consumptionChoices,
    inventoryApplyPending,
    scheduleRemoval,
    updatedItems,
  ]);

  const handleUndoInventory = useCallback(() => {
    undoRemoval();
    setUpdatedItems(null);
  }, [undoRemoval]);

  const markShoppingOpened = useCallback((key: string) => {
    setOpenedShoppingKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }, []);

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
  const isLastCookingStep =
    cookingStepIndex !== null &&
    dish != null &&
    cookingStepIndex === dish.steps.length - 1;
  const mutationError = errorMessage;
  const favoriteMutationError =
    setFavoriteMutation.error instanceof Error
      ? setFavoriteMutation.error.message
      : null;

  useEffect(() => {
    if (errorMessage) {
      setUpdatedItems(null);
    }
  }, [errorMessage]);

  return {
    recommendationId,
    requestedDishIndex,
    recommendationQuery,
    inventoryQuery,
    consumeMutation: { isPending: inventoryApplyPending },
    setFavoriteMutation,
    currentIndex,
    checkedPrepKeys,
    setCheckedPrepKeys,
    consumptionChoices,
    setConsumptionChoices,
    updatedItems,
    undoLabel,
    handleUndoInventory,
    openedShoppingKeys,
    markShoppingOpened,
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
    isLastCookingStep,
    mutationError,
    favoriteMutationError,
  };
}
