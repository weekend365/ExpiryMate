import { formatBaseQuantity, type InventoryItem } from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useDeferredInventoryItemRemoval } from "../inventory/use-deferred-inventory-item-removal";
import { useInventoryList } from "../inventory/use-inventory-list";
import { useActiveSpace } from "../spaces/space-provider";
import { useAuth } from "../auth/use-auth";
import {
  buildBatchConsumeItems,
  buildCookingSteps,
  buildDefaultConsumptionChoices,
  buildOptimisticConsumedItems,
  reconcileConsumptionChoices,
  remainingPrepCount,
  resolveConsumableIngredients,
  resolveSelectedInventoryItem,
  type ConsumptionChoice,
} from "./cooking";
import {
  getCookingSessionDraftKey,
  loadCookingSessionDraft,
  type CookingSessionDraft,
} from "./cooking-session-draft";
import { createCookingSessionDraftWriter } from "./cooking-session-draft-writer";
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
  const { sessionUserId } = useAuth();
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
  const [pendingDraft, setPendingDraft] = useState<CookingSessionDraft | null>(
    null,
  );
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [isDraftResolved, setIsDraftResolved] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const draftWriter = useMemo(
    () =>
      createCookingSessionDraftWriter({
        onError: () =>
          setDraftSaveError(
            "조리 기록을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
          ),
        onSuccess: () => setDraftSaveError(null),
      }),
    [],
  );
  const cookingCompletedRecorded = useRef(false);
  const appliedStepRouteRef = useRef<string | null>(null);

  const recommendation = recommendationQuery.data;
  const dish =
    Number.isInteger(requestedDishIndex) && requestedDishIndex >= 0
      ? recommendation?.recommendations[requestedDishIndex]
      : undefined;
  const steps = useMemo(() => (dish ? buildCookingSteps(dish) : []), [dish]);
  const dishStepCount = dish?.steps.length ?? null;
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
  const draftKey = useMemo(
    () =>
      sessionUserId && activeSpaceId && recommendationId
        ? getCookingSessionDraftKey(
            sessionUserId,
            activeSpaceId,
            recommendationId,
            requestedDishIndex,
          )
        : null,
    [activeSpaceId, recommendationId, requestedDishIndex, sessionUserId],
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

  const applyDraft = useCallback(
    (draft: CookingSessionDraft, routeStepIndex?: number) => {
      const maxIndex = Math.max(0, steps.length - 1);
      setCurrentIndex(
        routeStepIndex == null
          ? Math.min(draft.currentIndex, maxIndex)
          : Math.min(routeStepIndex + 1, maxIndex),
      );
      const prepKeys = new Set(prepRows.map((row) => row.key));
      setCheckedPrepKeys(
        draft.checkedPrepKeys.filter((key) => prepKeys.has(key)),
      );
      setCompletedCookingSteps(
        draft.completedCookingSteps.filter(
          (index) => index >= 0 && index < (dish?.steps.length ?? 0),
        ),
      );
      setConsumptionChoices(
        inventoryQuery.isPending || inventoryQuery.isError
          ? draft.consumptionChoices
          : reconcileConsumptionChoices(
              consumableIngredients,
              draft.consumptionChoices,
            ),
      );
    },
    [
      consumableIngredients,
      dish?.steps.length,
      inventoryQuery.isError,
      inventoryQuery.isPending,
      prepRows,
      steps.length,
    ],
  );
  const applyDraftRef = useRef(applyDraft);

  useEffect(() => {
    applyDraftRef.current = applyDraft;
  }, [applyDraft]);

  useEffect(() => {
    let active = true;
    setPendingDraft(null);
    setIsDraftHydrated(false);
    setIsDraftResolved(false);

    if (!draftKey || dishStepCount === null) {
      setIsDraftHydrated(true);
      setIsDraftResolved(true);
      return () => {
        active = false;
      };
    }
    setCurrentIndex(0);
    setCheckedPrepKeys([]);
    setCompletedCookingSteps([]);
    setConsumptionChoices({});
    setUpdatedItems(null);
    void loadCookingSessionDraft(draftKey)
      .then((draft) => {
        if (!active) {
          return;
        }
        const hasRequestedStep =
          Number.isInteger(requestedStepIndex) &&
          requestedStepIndex >= 0 &&
          requestedStepIndex < dishStepCount;
        if (draft && hasRequestedStep) {
          applyDraftRef.current(draft, requestedStepIndex);
          setIsDraftResolved(true);
        } else if (draft) {
          setPendingDraft(draft);
        } else {
          setIsDraftResolved(true);
        }
      })
      .catch(() => {
        if (active) {
          setIsDraftResolved(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsDraftHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [dishStepCount, draftKey, requestedStepIndex]);

  const persistCookingSession = useCallback(() => {
    if (!draftKey || !dish || !isDraftHydrated || !isDraftResolved) {
      return draftWriter.flush();
    }
    if (updatedItems !== null) {
      return draftWriter.clear(draftKey);
    }
    const hasProgress =
      currentIndex > 0 ||
      checkedPrepKeys.length > 0 ||
      completedCookingSteps.length > 0;
    if (!hasProgress) {
      return draftWriter.clear(draftKey);
    }
    return draftWriter.save(draftKey, {
      currentIndex,
      checkedPrepKeys,
      completedCookingSteps,
      consumptionChoices,
    });
  }, [
    checkedPrepKeys,
    completedCookingSteps,
    consumptionChoices,
    currentIndex,
    dish,
    draftKey,
    draftWriter,
    isDraftHydrated,
    isDraftResolved,
    updatedItems,
  ]);

  useEffect(() => {
    void persistCookingSession();
  }, [persistCookingSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        void persistCookingSession().then(() => draftWriter.flush());
      }
    });
    return () => subscription.remove();
  }, [draftWriter, persistCookingSession]);

  const resumeCookingSession = useCallback(() => {
    if (!pendingDraft) {
      return;
    }
    applyDraft(pendingDraft);
    setPendingDraft(null);
    setIsDraftResolved(true);
  }, [applyDraft, pendingDraft]);

  const restartCookingSession = useCallback(() => {
    setCurrentIndex(0);
    setCheckedPrepKeys([]);
    setCompletedCookingSteps([]);
    setConsumptionChoices(
      buildDefaultConsumptionChoices(consumableIngredients),
    );
    setPendingDraft(null);
    setIsDraftResolved(true);
    if (draftKey) {
      void draftWriter.clear(draftKey);
    }
  }, [consumableIngredients, draftKey, draftWriter]);

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
    if (inventoryQuery.isPending || inventoryQuery.isError) {
      return;
    }

    setConsumptionChoices((current) =>
      reconcileConsumptionChoices(consumableIngredients, current),
    );
  }, [
    consumableIngredients,
    inventoryQuery.isError,
    inventoryQuery.isPending,
  ]);

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

  const goToCookingStep = useCallback(
    (stepIndex: number) => {
      if (!dish || stepIndex < 0 || stepIndex >= dish.steps.length) {
        return;
      }
      setCurrentIndex(stepIndex + 1);
    },
    [dish],
  );

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
    activeSpaceId,
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
    pendingDraft,
    isDraftHydrated,
    draftSaveError,
    retryCookingSessionSave: persistCookingSession,
    resumeCookingSession,
    restartCookingSession,
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
    goToCookingStep,
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
