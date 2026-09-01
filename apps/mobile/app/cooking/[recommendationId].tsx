import {
  extractRecipeStepTimerSeconds,
  formatBaseQuantity,
  ItemStatus,
} from "@expirymate/shared";
import { router, useNavigation } from "expo-router";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  CookingPot,
  Heart,
  ListChecks,
  Refrigerator,
  RotateCcw,
  ShoppingBasket,
  SlidersHorizontal,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Alert, BackHandler, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { AppText } from "../../src/components/AppText";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { HeaderBackButton } from "../../src/components/HeaderBackButton";
import { Pill } from "../../src/components/Pill";
import { QuantityStepper } from "../../src/components/QuantityStepper";
import { Screen } from "../../src/components/Screen";
import { StepFlow } from "../../src/components/StepFlow";
import {
  getCookingGuideMessage,
  getCookingStepCta,
  getInventoryApplyCta,
  getPrepContinueCta,
  hasSelectedConsumption,
  listDepletedShoppingTargets,
  recommendedAmountForInventoryItem,
  remainingQuantityBase,
  resolveConsumptionAmount,
  resolveSelectedInventoryItem,
  unitLabel,
  type ConsumableIngredient,
  type ConsumptionChoice,
  type ConsumptionMode,
} from "../../src/features/recipes/cooking";
import { useCookingSession } from "../../src/features/recipes/use-cooking-session";
import { CookingTimerCard } from "../../src/features/recipes/cooking-timer-card";
import { ActiveCookingTimerBar } from "../../src/features/recipes/active-cooking-timer-bar";
import { CookingStepText } from "../../src/features/recipes/CookingStepText";
import {
  isCookingTimerForStep,
  type CookingTimer,
  type StartCookingTimerInput,
} from "../../src/features/recipes/cooking-timer";
import { useCookingTimer } from "../../src/features/recipes/use-cooking-timer";
import { useAuth } from "../../src/features/auth/use-auth";
import { useAffiliateShopping } from "../../src/features/affiliate/use-affiliate-shopping";
import {
  AffiliateEntryImpression,
  trackAffiliateEntryTap,
} from "../../src/features/affiliate/affiliate-entry-tracking";
import { InventoryUndoSnackbar } from "../../src/features/inventory/inventory-undo-snackbar";
import { colors, radius, spacing, controlSize } from "../../src/shared/theme";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { useAppStore } from "../../src/store/app-store";

const COOKING_KEEP_AWAKE_TAG = "expirymate-active-cooking";

function CookingKeepAwake() {
  useKeepAwake(COOKING_KEEP_AWAKE_TAG);
  return null;
}

export default function CookingScreen() {
  const navigation = useNavigation();
  const { shouldStack, isRegular } = useResponsiveLayout();
  const { sessionUserId } = useAuth();
  const cookingTimer = useCookingTimer(sessionUserId);
  const {
    activeSpaceId,
    recommendationId,
    requestedDishIndex,
    recommendationQuery,
    inventoryQuery,
    consumeMutation,
    setFavoriteMutation,
    currentIndex,
    setCheckedPrepKeys,
    consumptionChoices,
    setConsumptionChoices,
    updatedItems,
    pendingDraft,
    isDraftHydrated,
    draftSaveError,
    retryCookingSessionSave,
    resumeCookingSession,
    restartCookingSession,
    undoLabel,
    handleUndoInventory,
    openedShoppingKeys,
    markShoppingOpened,
    dish,
    steps,
    completedCookingSteps,
    completionStepIndex,
    consumptionStepIndex,
    cookingStepIndex,
    prepRows,
    consumableIngredients,
    isFavorite,
    goToPreviousStep,
    goForward,
    goToCookingStep,
    goToFlowStep,
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
  } = useCookingSession();
  const shoppingQuery = useAffiliateShopping();
  const [isInventoryEditing, setIsInventoryEditing] = useState(false);
  const [stepsOverviewVisible, setStepsOverviewVisible] = useState(false);
  const keepCookingScreenAwake = useAppStore(
    (state) => state.keepCookingScreenAwake,
  );
  const setPendingCookingCleanup = useAppStore(
    (state) => state.setPendingCookingCleanup,
  );
  const pulseStepTransition = useCallback(
    () =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      ),
    [],
  );
  const handlePreviousStep = useCallback(() => {
    void pulseStepTransition();
    goToPreviousStep();
  }, [goToPreviousStep, pulseStepTransition]);
  const handleForwardStep = useCallback(() => {
    void pulseStepTransition();
    goForward();
  }, [goForward, pulseStepTransition]);
  const handleCompleteCookingStep = useCallback(() => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);
    completeCookingStepAndAdvance();
  }, [completeCookingStepAndAdvance]);
  const cookingSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(cookingStepIndex !== null)
        .activeOffsetX([-24, 24])
        .failOffsetY([-24, 24])
        .onEnd((event) => {
          if (event.translationX <= -72 || event.velocityX <= -650) {
            runOnJS(handleCompleteCookingStep)();
          } else if (event.translationX >= 72 || event.velocityX >= 650) {
            runOnJS(handlePreviousStep)();
          }
        }),
    [cookingStepIndex, handleCompleteCookingStep, handlePreviousStep],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderBackButton onPress={handlePreviousStep} />,
      gestureEnabled: currentIndex === 0 || updatedItems !== null,
    });
  }, [currentIndex, handlePreviousStep, navigation, updatedItems]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handlePreviousStep();
        return true;
      },
    );

    return () => subscription.remove();
  }, [handlePreviousStep]);

  useEffect(() => {
    if (currentIndex !== consumptionStepIndex) {
      setIsInventoryEditing(false);
    }
  }, [consumptionStepIndex, currentIndex]);

  useEffect(() => {
    if (
      currentIndex !== consumptionStepIndex ||
      !dish ||
      !recommendationId
    ) {
      return;
    }
    if (updatedItems !== null) {
      setPendingCookingCleanup(null);
      return;
    }
    if (mutationError) {
      setPendingCookingCleanup({
        recommendationId,
        dishIndex: requestedDishIndex,
        dishTitle: dish.title,
        createdAt: Date.now(),
      });
    }
  }, [
    consumptionStepIndex,
    currentIndex,
    dish,
    mutationError,
    recommendationId,
    requestedDishIndex,
    setPendingCookingCleanup,
    updatedItems,
  ]);

  if (recommendationQuery.isPending) {
    return (
      <Screen contentWidth="wide" density="compact" topInsetMode="none">
        <EmptyState
          kind="loading"
          mood="think"
          title="레시피를 펼치고 있어요"
          description="조금만 기다리면 조리를 시작할 수 있어요."
        />
      </Screen>
    );
  }

  if (!recommendationId || recommendationQuery.isError || !dish) {
    return (
      <Screen
        contentWidth="wide"
        density="compact"
        topInsetMode="none"
        footer={
          <Button
            onPress={() => router.replace("/(tabs)/recommendations")}
            fullWidth
          >
            추천으로 이동
          </Button>
        }
      >
        <EmptyState
          kind="error"
          mood="worry"
          title="이 레시피를 다시 찾지 못했어요"
          description="추천 탭에서 요리를 다시 골라볼까요?"
        />
      </Screen>
    );
  }

  if (!isDraftHydrated) {
    return (
      <Screen contentWidth="wide" density="compact" topInsetMode="none">
        <EmptyState
          kind="loading"
          mood="think"
          title="하던 요리가 있는지 확인하고 있어요"
          description="저장된 준비 체크와 조리 단계를 안전하게 불러올게요."
        />
      </Screen>
    );
  }

  if (updatedItems) {
    const depletedTargets = listDepletedShoppingTargets(
      updatedItems,
      consumableIngredients,
      (shoppingQuery.data?.productGroups ?? []).map(
        (group) => group.ingredientName,
      ),
      openedShoppingKeys,
    ).slice(0, 3);

    return (
      <Screen
        contentWidth="wide"
        density="compact"
        topInsetMode="none"
        title="요리를 다 마쳤어요"
        subtitle={
          updatedItems.length
            ? `재료 ${updatedItems.length}개의 재고를 업데이트했어요.`
            : "이번에는 재고를 그대로 두었어요."
        }
        footer={
          <View style={styles.footerStack}>
            {undoLabel ? (
              <InventoryUndoSnackbar
                label={undoLabel}
                stacked={shouldStack}
                onUndo={handleUndoInventory}
              />
            ) : null}
            <Button
              icon={Refrigerator}
              onPress={() => router.replace("/(tabs)/home")}
              fullWidth
            >
              보관함 보기
            </Button>
            <Button
              variant="surface"
              onPress={() => router.replace("/(tabs)/recommendations")}
              fullWidth
            >
              다른 요리 보기
            </Button>
          </View>
        }
      >
        {depletedTargets.length ? (
          <AffiliateEntryImpression placement="cooking_complete">
            <View style={styles.shoppingSummaryCard}>
              <View style={styles.shoppingSummaryIcon}>
                <ShoppingBasket
                  color={colors.primaryForeground}
                  size={spacing.md}
                  strokeWidth={2.3}
                />
              </View>
              <View style={styles.shoppingSummaryCopy}>
                <AppText variant="subheading">
                  오늘 다 쓴 재료 {depletedTargets.length}개 다시 채우기
                </AppText>
                <AppText variant="bodySmall" tone="subtext">
                  {depletedTargets.map((target) => target.label).join(" · ")}
                </AppText>
              </View>
              <Button
                variant="surface"
                icon={ShoppingBasket}
                onPress={() => {
                  trackAffiliateEntryTap("cooking_complete");
                  depletedTargets.forEach((target) =>
                    markShoppingOpened(target.key),
                  );
                  router.push({
                    pathname: "/(tabs)/shop",
                    params: {
                      items: JSON.stringify(
                        depletedTargets.map((target) => target.searchName),
                      ),
                      source: "cooking_complete",
                    },
                  });
                }}
                fullWidth
              >
                장보기에서 모두 보기
              </Button>
            </View>
          </AffiliateEntryImpression>
        ) : null}
        {updatedItems.length ? (
          <View style={styles.remainingCard}>
            <AppText variant="subheading">냉장고에 남은 양</AppText>
            {updatedItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.remainingRow,
                  shouldStack && styles.remainingRowStacked,
                ]}
              >
                <AppText variant="body" style={styles.remainingName}>
                  {item.displayName}
                </AppText>
                <AppText variant="bodySmall" tone="subtext">
                  {item.status === ItemStatus.CONSUMED ||
                  item.quantityBase === 0
                    ? "다 사용했어요"
                    : `${formatBaseQuantity(item.quantityBase, item.unitCode)} 남았어요`}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Screen>
    );
  }

  const stepTimerSeconds =
    cookingStepIndex !== null
      ? (dish.stepTimerSeconds?.[cookingStepIndex] ??
        extractRecipeStepTimerSeconds(dish.steps[cookingStepIndex] ?? ""))
      : null;
  const timerInput: StartCookingTimerInput | null =
    cookingStepIndex !== null &&
    stepTimerSeconds &&
    sessionUserId &&
    activeSpaceId
      ? {
          ownerKey: sessionUserId,
          spaceId: activeSpaceId,
          recommendationId,
          dishIndex: requestedDishIndex,
          stepIndex: cookingStepIndex,
          dishTitle: dish.title,
          stepText: dish.steps[cookingStepIndex] ?? "",
          durationSeconds: stepTimerSeconds,
        }
      : null;

  const handleStartTimer = () => {
    if (!timerInput) {
      return;
    }
    const activeTimer = cookingTimer.timer;
    const isAnotherActiveTimer =
      activeTimer != null &&
      (activeTimer.status === "running" || activeTimer.status === "paused") &&
      !isCookingTimerForStep(
        activeTimer,
        timerInput.recommendationId,
        timerInput.dishIndex,
        timerInput.stepIndex,
      );

    if (isAnotherActiveTimer) {
      Alert.alert(
        "실행 중인 타이머를 바꿀까요?",
        `${activeTimer.dishTitle} ${activeTimer.stepIndex + 1}단계 타이머가 취소돼요.`,
        [
          { text: "기존 타이머 유지", style: "cancel" },
          {
            text: "새 타이머 시작",
            style: "destructive",
            onPress: () => void cookingTimer.start(timerInput, true),
          },
        ],
      );
      return;
    }

    void cookingTimer.start(timerInput);
  };

  const timer = cookingTimer.timer;
  const currentTimerCompleted = Boolean(
    timer &&
      timer.status === "completed" &&
      cookingStepIndex !== null &&
      isCookingTimerForStep(
        timer,
        recommendationId,
        requestedDishIndex,
        cookingStepIndex,
      ),
  );
  const handleCleanupNow = () => {
    setPendingCookingCleanup(null);
    handleForwardStep();
  };
  const handleCleanupLater = () => {
    setPendingCookingCleanup({
      recommendationId,
      dishIndex: requestedDishIndex,
      dishTitle: dish.title,
      createdAt: Date.now(),
    });
    void retryCookingSessionSave().finally(() => {
      router.replace("/(tabs)/home");
    });
  };
  const handleApplyInventoryAndClear = () => {
    handleApplyInventory();
  };

  const primaryFooter =
    currentIndex === 0 ? (
      <View style={styles.footerStack}>
        {uncheckedPrepCount > 0 ? (
          <>
            <AppText
              variant="bodySmall"
              tone="muted"
              style={styles.ctaHint}
              accessibilityLiveRegion="polite"
            >
              없어도 조리를 이어갈 수 있어요.
            </AppText>
            <Button
              icon={ShoppingBasket}
              variant="surface"
              onPress={() => router.push("/(tabs)/shop")}
              fullWidth
            >
          없는 재료 장보기
            </Button>
          </>
        ) : null}
        <Button
          icon={ChevronRight}
          iconPosition="right"
          onPress={handleForwardStep}
          fullWidth
        >
          {getPrepContinueCta(uncheckedPrepCount)}
        </Button>
      </View>
    ) : cookingStepIndex !== null ? (
      <Button
        icon={ChevronRight}
        iconPosition="right"
        onPress={handleCompleteCookingStep}
        style={styles.handsBusyButton}
        fullWidth
      >
        {currentTimerCompleted
          ? isLastCookingStep
            ? "타이머 완료 · 요리 완성"
            : "타이머 완료 · 다음 단계"
          : getCookingStepCta(isLastCookingStep)}
      </Button>
    ) : currentIndex === completionStepIndex ? (
      <View style={styles.footerStack}>
        <Button
          icon={Refrigerator}
          onPress={handleCleanupNow}
          style={styles.handsBusyButton}
          fullWidth
        >
          사용한 재료 정리
        </Button>
        <Button variant="surface" onPress={handleCleanupLater} fullWidth>
          나중에
        </Button>
      </View>
    ) : (
      <Button
        icon={Refrigerator}
        onPress={handleApplyInventoryAndClear}
        loading={consumeMutation.isPending}
        disabled={inventoryQuery.isPending || consumeMutation.isPending}
        fullWidth
      >
        {getInventoryApplyCta(
          hasSelectedConsumption(consumptionChoices),
          isInventoryEditing,
        )}
      </Button>
    );

  const showsActiveTimerBar = Boolean(
    timer &&
      timer.recommendationId === recommendationId &&
      timer.dishIndex === requestedDishIndex &&
      timer.stepIndex !== cookingStepIndex,
  );
  const footer = showsActiveTimerBar ? (
    <View style={styles.screenFooter}>
      <ActiveCookingTimerBar
        controller={cookingTimer}
        onOpenStep={goToCookingStep}
      />
      {primaryFooter}
    </View>
  ) : (
    primaryFooter
  );

  const draftStepLabel = pendingDraft
    ? pendingDraft.currentIndex === 0
      ? "재료 준비"
      : pendingDraft.currentIndex <= dish.steps.length
        ? `조리 ${pendingDraft.currentIndex}단계`
        : pendingDraft.currentIndex === completionStepIndex
          ? "요리 완성"
          : "재고 반영"
    : null;

  return (
    <>
      <Screen
        contentWidth="wide"
        density="compact"
        topInsetMode="none"
        footer={footer}
      >
        {keepCookingScreenAwake && cookingStepIndex !== null ? (
          <CookingKeepAwake />
        ) : null}
        <StepFlow
          steps={steps}
          currentIndex={currentIndex}
          onBack={handlePreviousStep}
          onProgressPress={() => setStepsOverviewVisible(true)}
          density="compact"
          hideBack
          guideMessage={getCookingGuideMessage(
            currentIndex,
            dish.steps.length,
            uncheckedPrepCount,
          )}
          guideMood={currentIndex >= completionStepIndex ? "happy" : "cooking"}
        >
        {draftSaveError ? (
          <View
            testID="cooking-session-save-error"
            style={styles.errorCard}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <AppText variant="bodySmall" tone="danger">
              {draftSaveError}
            </AppText>
            <Button
              variant="surface"
              size="small"
              onPress={() => void retryCookingSessionSave()}
              fullWidth
            >
              다시 저장
            </Button>
          </View>
        ) : null}
        {currentIndex === 0 ? (
          <View style={styles.section}>
            <AppText variant="body" tone="subtext">
              하나씩 눌러 준비한 재료를 표시해 주세요.
            </AppText>
            <View
              style={[styles.prepList, isRegular && styles.prepListRegular]}
            >
              {prepRows.map((ingredient) => {
                const checked = checkedPrepKeySet.has(ingredient.key);
                return (
                  <Pressable
                    key={ingredient.key}
                    onPress={() =>
                      setCheckedPrepKeys((current) =>
                        current.includes(ingredient.key)
                          ? current.filter((key) => key !== ingredient.key)
                          : [...current, ingredient.key],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${ingredient.name}${
                      ingredient.amountLabel ? ` ${ingredient.amountLabel}` : ""
                    }`}
                    style={({ pressed }) => [
                      styles.checkRow,
                      isRegular && styles.checkRowRegular,
                      checked && styles.checkRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {checked ? (
                      <CheckCircle2
                        color={colors.primaryForeground}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Circle
                        color={colors.mutedText}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.2}
                      />
                    )}
                    <View style={styles.rowCopy}>
                      <AppText variant="bodyStrong">{ingredient.name}</AppText>
                      {ingredient.amountLabel ? (
                        <AppText variant="bodySmall" tone="subtext">
                          추천 사용량 {ingredient.amountLabel}
                        </AppText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {dish.safetyNote ? (
              <View style={styles.safetyCard}>
                <AppText variant="bodyStrong">먼저 살펴볼까요?</AppText>
                <AppText variant="bodySmall" tone="subtext">
                  {dish.safetyNote}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {cookingStepIndex !== null ? (
          <GestureDetector gesture={cookingSwipeGesture}>
            <View style={styles.section}>
              <Pressable
                onPress={() => toggleCookingStep(cookingStepIndex)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: cookingStepCompleted }}
                accessibilityLabel={`${cookingStepIndex + 1}단계 ${
                  cookingStepCompleted ? "완료됨" : "완료로 표시"
                }`}
                style={({ pressed }) => [
                  styles.cookingCard,
                  cookingStepCompleted && styles.cookingCardCompleted,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.stepNumber}>
                  <AppText
                    variant="label"
                    tone="inverse"
                    scaleRole="chrome"
                    densityAware={false}
                  >
                    {cookingStepIndex + 1}
                  </AppText>
                </View>
                <CookingStepText
                  text={dish.steps[cookingStepIndex]}
                  highlightTimes={Boolean(timerInput)}
                  style={styles.cookingText}
                />
                {cookingStepCompleted ? (
                  <CheckCircle2
                    color={colors.primaryForeground}
                    size={spacing.md}
                    strokeWidth={2.4}
                  />
                ) : (
                  <CookingPot
                    color={colors.mutedText}
                    size={spacing.md}
                    strokeWidth={2.2}
                  />
                )}
              </Pressable>
              {timerInput ? (
                <CookingTimerCard
                  input={timerInput}
                  controller={cookingTimer}
                  onStart={handleStartTimer}
                />
              ) : null}
              {dish.tips.length ? (
                <View style={styles.tipCard}>
                  <AppText variant="bodyStrong">장고의 조리 팁</AppText>
                  <AppText variant="bodySmall" tone="subtext">
                    {dish.tips.join(" ")}
                  </AppText>
                </View>
              ) : null}
              <AppText variant="bodySmall" tone="muted" style={styles.swipeHint}>
                왼쪽으로 밀면 다음 단계 · 오른쪽으로 밀면 이전 단계
              </AppText>
            </View>
          </GestureDetector>
        ) : null}

        {currentIndex === completionStepIndex ? (
          <View style={styles.section} testID="cooking-completion-moment">
            <View style={styles.completionCard}>
              <AppText variant="subheading">마지막으로 확인할까요?</AppText>
              <AppText variant="bodySmall" tone="subtext">
                {dish.tips[0] ??
                  "불과 조리도구를 안전하게 정리하고 맛있게 담아 주세요."}
              </AppText>
              <Button
                icon={Heart}
                variant="surface"
                onPress={handleToggleFavorite}
                loading={setFavoriteMutation.isPending}
                fullWidth
              >
                {isFavorite ? "즐겨찾기 해제" : "즐겨찾기에 추가"}
              </Button>
              <Button
                icon={RotateCcw}
                variant="surface"
                onPress={() => {
                  void pulseStepTransition();
                  setPendingCookingCleanup(null);
                  restartCookingSession();
                }}
                fullWidth
              >
                처음부터 다시 보기
              </Button>
            </View>
            {favoriteMutationError ? (
              <View style={styles.errorCard}>
                <AppText variant="bodySmall" tone="danger">
                  즐겨찾기를 바꾸지 못했어요. 잠시 뒤 다시 눌러주세요.
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        {currentIndex === consumptionStepIndex ? (
          <View style={styles.section}>
            <AppText variant="body" tone="subtext">
              추천 사용량을 먼저 확인하고, 다른 경우에만 수정해 주세요.
            </AppText>
            {inventoryQuery.isError ? (
              <View style={styles.errorCard}>
                <AppText variant="bodySmall" tone="danger">
                  앗, 냉장고의 최신 상태를 불러오지 못했어요.
                </AppText>
              </View>
            ) : null}
            {consumableIngredients.length ? (
              <ConsumptionSummary
                ingredients={consumableIngredients}
                choices={consumptionChoices}
                isEditing={isInventoryEditing}
                onToggleEditing={() =>
                  setIsInventoryEditing((current) => !current)
                }
              />
            ) : null}
            {isInventoryEditing ? (
              <View style={[styles.list, isRegular && styles.listRegular]}>
                {consumableIngredients.map((ingredient) => (
                  <ConsumptionCard
                    key={ingredient.key}
                    ingredient={ingredient}
                    choice={
                      consumptionChoices[ingredient.key] ?? {
                        mode: "skip",
                        amountBase: 0,
                        selectedInventoryItemId: null,
                      }
                    }
                    onChange={(choice) =>
                      setConsumptionChoices((current) => ({
                        ...current,
                        [ingredient.key]: choice,
                      }))
                    }
                  />
                ))}
              </View>
            ) : null}
            {!inventoryQuery.isPending && !consumableIngredients.length ? (
              <View style={styles.tipCard}>
                <AppText variant="bodyStrong">
                  이번에는 직접 정리해 주세요
                </AppText>
                <AppText variant="bodySmall" tone="subtext">
                  추천을 받은 뒤 재고 상태가 달라져 자동으로 연결할 재료가
                  없어요.
                </AppText>
              </View>
            ) : null}
            {mutationError ? (
              <View style={styles.errorCard}>
                <AppText variant="bodySmall" tone="danger">
                  {mutationError}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        </StepFlow>
      </Screen>
      <BottomSheet
        visible={pendingDraft !== null}
        onClose={() => undefined}
        dismissible={false}
        mascotMood="cooking"
        title="하던 요리를 이어갈까요?"
        description={
          draftStepLabel
            ? `${draftStepLabel}까지 저장되어 있어요. 24시간 동안 이어서 볼 수 있어요.`
            : undefined
        }
        footer={
          <View style={styles.footerStack} testID="cooking-session-resume-sheet">
            <Button onPress={resumeCookingSession} fullWidth>
              이어서 조리
            </Button>
            <Button
              variant="surface"
              onPress={restartCookingSession}
              fullWidth
            >
              처음부터 시작
            </Button>
          </View>
        }
      >
        <AppText variant="body" tone="subtext">
          준비 체크, 완료한 단계, 재고 사용량을 그대로 복원해요.
        </AppText>
      </BottomSheet>
      <BottomSheet
        visible={stepsOverviewVisible}
        onClose={() => setStepsOverviewVisible(false)}
        title="전체 조리 단계"
        description="앞뒤 단계를 미리 보고 원하는 단계로 바로 이동할 수 있어요."
        footer={
          <Button
            variant="surface"
            onPress={() => setStepsOverviewVisible(false)}
            fullWidth
          >
            현재 단계로 돌아가기
          </Button>
        }
      >
        <CookingStepsOverview
          steps={steps}
          dishSteps={dish.steps}
          currentIndex={currentIndex}
          completionStepIndex={completionStepIndex}
          consumptionStepIndex={consumptionStepIndex}
          completedCookingSteps={completedCookingSteps}
          timer={timer}
          recommendationId={recommendationId}
          dishIndex={requestedDishIndex}
          onSelect={(index) => {
            void pulseStepTransition();
            goToFlowStep(index);
            setStepsOverviewVisible(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

function CookingStepsOverview({
  steps,
  dishSteps,
  currentIndex,
  completionStepIndex,
  consumptionStepIndex,
  completedCookingSteps,
  timer,
  recommendationId,
  dishIndex,
  onSelect,
}: {
  steps: Array<{ key: string; label: string; title: string }>;
  dishSteps: string[];
  currentIndex: number;
  completionStepIndex: number;
  consumptionStepIndex: number;
  completedCookingSteps: number[];
  timer: CookingTimer | null;
  recommendationId: string;
  dishIndex: number;
  onSelect: (index: number) => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  const allCookingComplete =
    completedCookingSteps.length >= dishSteps.length;

  return (
    <View style={styles.overviewList} testID="cooking-steps-overview">
      {steps.map((step, index) => {
        const cookingIndex =
          index > 0 && index < completionStepIndex ? index - 1 : null;
        const isCurrent = index === currentIndex;
        const isCompleted =
          index === 0
            ? currentIndex > 0
            : cookingIndex !== null
              ? completedCookingSteps.includes(cookingIndex)
              : index === completionStepIndex
                ? currentIndex > completionStepIndex
                : false;
        const hasTimer = Boolean(
          cookingIndex !== null &&
            timer &&
            timer.recommendationId === recommendationId &&
            timer.dishIndex === dishIndex &&
            timer.stepIndex === cookingIndex,
        );
        const disabled =
          index === consumptionStepIndex && !allCookingComplete;
        const description =
          cookingIndex !== null
            ? dishSteps[cookingIndex]
            : index === 0
              ? "재료와 추천 사용량을 확인해요."
              : index === completionStepIndex
                ? "완성된 요리를 즐기고 다음 행동을 골라요."
                : "실제로 사용한 재료를 냉장고에 반영해요.";

        return (
          <Pressable
            key={step.key}
            onPress={() => onSelect(index)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent, disabled }}
            accessibilityLabel={`${step.label}, ${
              isCurrent ? "현재 단계" : isCompleted ? "완료" : "미완료"
            }${hasTimer ? ", 타이머 연결됨" : ""}`}
            accessibilityHint={
              disabled
                ? "모든 조리 단계를 마치면 이동할 수 있어요"
                : "이 단계로 이동해요"
            }
            style={({ pressed }) => [
              styles.overviewRow,
              shouldStack && styles.overviewRowStacked,
              isCurrent && styles.overviewRowCurrent,
              hasTimer && styles.overviewRowTimer,
              disabled && styles.overviewRowDisabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.overviewIcon}>
              {isCompleted ? (
                <CheckCircle2
                  color={colors.primaryForeground}
                  size={spacing.md}
                  strokeWidth={2.4}
                />
              ) : hasTimer ? (
                <ListChecks
                  color={colors.primaryForeground}
                  size={spacing.md}
                  strokeWidth={2.4}
                />
              ) : (
                <Circle
                  color={isCurrent ? colors.primaryForeground : colors.mutedText}
                  size={spacing.md}
                  strokeWidth={2.2}
                />
              )}
            </View>
            <View style={styles.rowCopy}>
              <AppText
                variant="bodyStrong"
                tone={isCurrent || hasTimer ? "primary" : "default"}
              >
                {step.label}
              </AppText>
              <AppText
                variant="bodySmall"
                tone="subtext"
                numberOfLines={shouldStack ? undefined : 2}
              >
                {description}
              </AppText>
            </View>
            <AppText variant="label" tone={isCurrent ? "primary" : "muted"}>
              {isCurrent
                ? "현재"
                : hasTimer
                  ? timer?.status === "completed"
                    ? "완료 알림"
                    : "타이머"
                  : isCompleted
                    ? "완료"
                    : disabled
                      ? "조리 후"
                      : "보기"}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ConsumptionSummary({
  ingredients,
  choices,
  isEditing,
  onToggleEditing,
}: {
  ingredients: ConsumableIngredient[];
  choices: Record<string, ConsumptionChoice>;
  isEditing: boolean;
  onToggleEditing: () => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  const rows = ingredients.flatMap((ingredient) => {
    const choice = choices[ingredient.key];
    const item = resolveSelectedInventoryItem(ingredient, choice);
    if (!choice || !item || choice.amountBase <= 0) {
      return [];
    }
    return [
      {
        key: ingredient.key,
        name: ingredient.name,
        used: formatBaseQuantity(choice.amountBase, item.unitCode),
        remaining: formatBaseQuantity(
          remainingQuantityBase(item.quantityBase, choice.amountBase),
          item.unitCode,
        ),
      },
    ];
  });
  const skippedCount = ingredients.length - rows.length;

  return (
    <View testID="cooking-inventory-summary" style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.rowCopy}>
          <AppText variant="subheading">추천 사용량 요약</AppText>
          <AppText variant="bodySmall" tone="subtext">
            {rows.length
              ? `${rows.length}개 재료를 재고에 반영해요.`
              : "이번에는 재고를 변경하지 않아요."}
          </AppText>
        </View>
        <AppText variant="label" tone="primary">
          {rows.length}개 선택
        </AppText>
      </View>
      {rows.map((row) => (
        <View
          key={row.key}
          style={[styles.summaryRow, shouldStack && styles.summaryRowStacked]}
        >
          <AppText variant="bodyStrong" style={styles.summaryName}>
            {row.name}
          </AppText>
          <AppText variant="bodySmall" tone="subtext">
            {row.used} 사용 · {row.remaining} 남음
          </AppText>
        </View>
      ))}
      {skippedCount > 0 ? (
        <AppText variant="bodySmall" tone="muted">
          연결되지 않았거나 반영하지 않는 재료 {skippedCount}개
        </AppText>
      ) : null}
      <Button
        testID="cooking-inventory-edit-button"
        variant="surface"
        size="small"
        icon={SlidersHorizontal}
        onPress={onToggleEditing}
        fullWidth
      >
        {isEditing ? "사용량 수정 닫기" : "사용량 수정"}
      </Button>
    </View>
  );
}

function ConsumptionCard({
  ingredient,
  choice,
  onChange,
}: {
  ingredient: ConsumableIngredient;
  choice: ConsumptionChoice;
  onChange: (choice: ConsumptionChoice) => void;
}) {
  const { isRegular } = useResponsiveLayout();
  const selectedItem = resolveSelectedInventoryItem(ingredient, choice);

  const selectCandidate = (item: (typeof ingredient.candidates)[number]) => {
    const recommended = recommendedAmountForInventoryItem(
      ingredient.recipeAmount,
      ingredient.recipeUnitCode,
      item,
    );
    onChange({
      mode: recommended ? "recommended" : "skip",
      amountBase: recommended ?? 0,
      selectedInventoryItemId: item.id,
    });
  };

  const selectMode = (mode: ConsumptionMode) => {
    if (!selectedItem) {
      return;
    }
    const recommended = recommendedAmountForInventoryItem(
      ingredient.recipeAmount,
      ingredient.recipeUnitCode,
      selectedItem,
    );
    onChange({
      mode,
      amountBase: resolveConsumptionAmount(
        mode,
        selectedItem.quantityBase,
        recommended,
      ),
      selectedInventoryItemId: selectedItem.id,
    });
  };

  const remaining = selectedItem
    ? remainingQuantityBase(selectedItem.quantityBase, choice.amountBase)
    : 0;
  const recommended = selectedItem
    ? recommendedAmountForInventoryItem(
        ingredient.recipeAmount,
        ingredient.recipeUnitCode,
        selectedItem,
      )
    : null;

  return (
    <View
      style={[
        styles.consumptionCard,
        isRegular && styles.consumptionCardRegular,
      ]}
    >
      <View style={styles.consumptionHeader}>
        <View style={styles.rowCopy}>
          <AppText variant="bodyStrong">{ingredient.name}</AppText>
          {ingredient.matchStatus === "unmatched" ? (
            <AppText variant="bodySmall" tone="subtext">
              보관함에 없는 재료
            </AppText>
          ) : selectedItem ? (
            <>
              {selectedItem.displayName !== ingredient.name ? (
                <AppText variant="bodySmall" tone="subtext">
                  {selectedItem.displayName}
                </AppText>
              ) : null}
              <AppText variant="bodySmall" tone="subtext">
                {formatBaseQuantity(
                  selectedItem.quantityBase,
                  selectedItem.unitCode,
                )}{" "}
                → {formatBaseQuantity(remaining, selectedItem.unitCode)}
              </AppText>
            </>
          ) : (
            <AppText variant="bodySmall" tone="subtext">
              사용할 재료를 골라 주세요
            </AppText>
          )}
        </View>
        {selectedItem && choice.amountBase > 0 ? (
          <AppText variant="bodySmall" tone="primary">
            {formatBaseQuantity(choice.amountBase, selectedItem.unitCode)}
          </AppText>
        ) : null}
      </View>
      {ingredient.matchStatus === "unmatched" ? null : (
        <>
          {ingredient.matchStatus === "multiple" ? (
            <View style={styles.pillRow}>
              {ingredient.candidates.map((item) => (
                <Pill
                  key={item.id}
                  label={item.displayName}
                  selected={choice.selectedInventoryItemId === item.id}
                  onPress={() => selectCandidate(item)}
                />
              ))}
            </View>
          ) : null}
          {selectedItem ? (
            <>
              <View style={styles.pillRow}>
                {recommended ? (
                  <Pill
                    label={`추천량 ${formatBaseQuantity(
                      recommended,
                      selectedItem.unitCode,
                    )}`}
                    selected={choice.mode === "recommended"}
                    onPress={() => selectMode("recommended")}
                  />
                ) : null}
                <Pill
                  label="전부 사용"
                  selected={choice.mode === "full"}
                  onPress={() => selectMode("full")}
                />
                <Pill
                  label="절반 사용"
                  selected={choice.mode === "half"}
                  onPress={() => selectMode("half")}
                />
                <Pill
                  label="직접 조절"
                  selected={choice.mode === "custom"}
                  onPress={() => selectMode("custom")}
                />
                <Pill
                  label="반영 안 함"
                  selected={choice.mode === "skip"}
                  onPress={() => selectMode("skip")}
                />
              </View>
              {choice.mode === "custom" ? (
                <QuantityStepper
                  label={`사용할 양 (${unitLabel(selectedItem.unitCode)})`}
                  value={choice.amountBase}
                  max={selectedItem.quantityBase}
                  onChange={(amountBase) =>
                    onChange({
                      mode: "custom",
                      amountBase: Math.min(amountBase, selectedItem.quantityBase),
                      selectedInventoryItemId: selectedItem.id,
                    })
                  }
                />
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  footerStack: {
    gap: spacing.sm,
  },
  screenFooter: {
    gap: spacing.sm,
  },
  handsBusyButton: {
    minHeight: controlSize.ctaLarge,
  },
  ctaHint: {
    textAlign: "center",
  },
  list: {
    gap: spacing.sm,
  },
  listRegular: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  prepList: {
    gap: spacing.xs,
  },
  prepListRegular: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  checkRow: {
    minHeight: controlSize.minimum,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  checkRowRegular: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
  },
  checkRowSelected: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    opacity: 0.72,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  safetyCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cookingCard: {
    minHeight: controlSize.ctaLarge,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cookingCardCompleted: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
  },
  stepNumber: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.actionPrimaryBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  cookingText: {
    flex: 1,
    minWidth: 0,
  },
  swipeHint: {
    textAlign: "center",
  },
  tipCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  completionCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  overviewList: {
    gap: spacing.xs,
  },
  overviewRow: {
    minHeight: controlSize.ctaLarge,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  overviewRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  overviewRowCurrent: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
  },
  overviewRowTimer: {
    borderColor: colors.primaryForeground,
  },
  overviewRowDisabled: {
    opacity: 0.5,
  },
  overviewIcon: {
    width: controlSize.icon,
    height: controlSize.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  consumptionCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  consumptionCardRegular: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
  },
  summaryCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  summaryRow: {
    minHeight: controlSize.minimum,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  summaryRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  summaryName: {
    flex: 1,
    minWidth: 0,
  },
  consumptionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  errorCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  remainingCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  shoppingSummaryCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  shoppingSummaryIcon: {
    width: controlSize.icon,
    height: controlSize.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  shoppingSummaryCopy: {
    gap: spacing.xxs,
  },
  remainingRow: {
    minHeight: controlSize.minimum,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  remainingRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  remainingName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
});
