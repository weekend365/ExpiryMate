import {
  formatBaseQuantity,
  ItemStatus,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  CookingPot,
  Heart,
  Refrigerator,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { Pill } from "../../src/components/Pill";
import { QuantityStepper } from "../../src/components/QuantityStepper";
import { Screen } from "../../src/components/Screen";
import { StepFlow } from "../../src/components/StepFlow";
import { useBatchConsumeInventoryItems } from "../../src/features/inventory/use-batch-consume-inventory-items";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import {
  buildBatchConsumeItems,
  buildCookingSteps,
  buildDefaultConsumptionChoices,
  getCookingGuideMessage,
  hasSelectedConsumption,
  resolveConsumableIngredients,
  resolveConsumptionAmount,
  unitLabel,
  type ConsumableIngredient,
  type ConsumptionChoice,
  type ConsumptionMode,
} from "../../src/features/recipes/cooking";
import { useRecipeRecommendation } from "../../src/features/recipes/use-recipe-recommendation";
import {
  getRecipeFavoriteKey,
  useRecipeFavorites,
  useSetRecipeFavorite,
} from "../../src/features/recipes/use-recipe-recommendations";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

export default function CookingScreen() {
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
      dish
        ? resolveConsumableIngredients(dish, inventoryQuery.data ?? [])
        : [],
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

  if (recommendationQuery.isPending) {
    return (
      <Screen>
        <EmptyState
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
        footer={
          <Button
            onPress={() => router.replace("/(tabs)/recommendations")}
            fullWidth
          >
            추천으로 돌아갈게요
          </Button>
        }
      >
        <EmptyState
          mood="worry"
          title="이 레시피를 다시 찾지 못했어요"
          description="추천 탭에서 요리를 다시 골라볼까요?"
        />
      </Screen>
    );
  }

  if (updatedItems) {
    return (
      <Screen
        title="요리를 다 마쳤어요"
        subtitle="사용한 만큼 냉장고에도 바로 알려뒀어요."
        footer={
          <Button
            icon={CheckCircle2}
            onPress={() => router.replace("/(tabs)/recommendations")}
            fullWidth
          >
            추천으로 돌아갈게요
          </Button>
        }
      >
        <EmptyState
          mood="happy"
          title="맛있게 완성했어요"
          description={
            updatedItems.length
              ? "남은 재료도 다음 요리에 알뜰하게 이어서 쓸게요."
              : "이번에는 재고를 그대로 두었어요."
          }
        />
        {updatedItems.length ? (
          <View style={styles.remainingCard}>
            <Text style={styles.cardTitle}>냉장고에 남은 양</Text>
            {updatedItems.map((item) => (
              <View key={item.id} style={styles.remainingRow}>
                <Text style={styles.remainingName}>{item.displayName}</Text>
                <Text style={styles.remainingAmount}>
                  {item.status === ItemStatus.CONSUMED ||
                  item.quantityBase === 0
                    ? "다 사용했어요"
                    : `${formatBaseQuantity(item.quantityBase, item.unitCode)} 남았어요`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Screen>
    );
  }

  const checkedPrepKeySet = new Set(checkedPrepKeys);
  const allPrepared =
    prepRows.length === 0 || checkedPrepKeys.length === prepRows.length;
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

  const goBack = () => {
    if (currentIndex === 0) {
      router.back();
      return;
    }
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  const goForward = () => {
    setCurrentIndex((index) => Math.min(consumptionStepIndex, index + 1));
  };

  const toggleCookingStep = (stepIndex: number) => {
    setCompletedCookingSteps((current) =>
      current.includes(stepIndex)
        ? current.filter((index) => index !== stepIndex)
        : [...current, stepIndex],
    );
  };

  const completeCookingStepAndAdvance = () => {
    if (cookingStepIndex === null) {
      return;
    }
    setCompletedCookingSteps((current) =>
      current.includes(cookingStepIndex)
        ? current
        : [...current, cookingStepIndex],
    );
    goForward();
  };

  const handleApplyInventory = async () => {
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
  };

  const handleToggleFavorite = () => {
    setFavoriteMutation.mutate({
      recommendationId,
      dishIndex: requestedDishIndex,
      dish,
      inventorySnapshot: recommendation?.inventorySnapshot ?? [],
      favorite: !isFavorite,
    });
  };

  const footer =
    currentIndex === 0 ? (
      <Button
        icon={ChevronRight}
        iconPosition="right"
        onPress={goForward}
        disabled={!allPrepared}
        fullWidth
      >
        재료가 준비됐어요
      </Button>
    ) : cookingStepIndex !== null ? (
      <Button
        icon={ChevronRight}
        iconPosition="right"
        onPress={completeCookingStepAndAdvance}
        fullWidth
      >
        이 단계까지 했어요
      </Button>
    ) : (
      <Button
        icon={Refrigerator}
        onPress={handleApplyInventory}
        loading={consumeMutation.isPending}
        disabled={inventoryQuery.isPending}
        fullWidth
      >
        {hasSelectedConsumption(consumptionChoices)
          ? "냉장고에도 반영할게요"
          : "재고는 그대로 둘게요"}
      </Button>
    );

  return (
    <Screen footer={footer}>
      <StepFlow
        steps={steps}
        currentIndex={currentIndex}
        onBack={goBack}
        guideMessage={getCookingGuideMessage(currentIndex, dish.steps.length)}
        guideMood={currentIndex === consumptionStepIndex ? "happy" : "cooking"}
      >
        {currentIndex === 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHint}>
              하나씩 눌러 준비한 재료를 표시해 주세요.
            </Text>
            <View style={styles.list}>
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
                      ingredient.amountLabel
                        ? ` ${ingredient.amountLabel}`
                        : ""
                    }`}
                    style={({ pressed }) => [
                      styles.checkRow,
                      checked && styles.checkRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {checked ? (
                      <CheckCircle2
                        color={colors.primary}
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Circle
                        color={colors.mutedText}
                        size={spacing.md}
                        strokeWidth={2.2}
                      />
                    )}
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{ingredient.name}</Text>
                      {ingredient.amountLabel ? (
                        <Text style={styles.rowDescription}>
                          추천 사용량 {ingredient.amountLabel}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {dish.safetyNote ? (
              <View style={styles.safetyCard}>
                <Text style={styles.safetyTitle}>먼저 살펴볼까요?</Text>
                <Text style={styles.safetyBody}>{dish.safetyNote}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {cookingStepIndex !== null ? (
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
                <Text style={styles.stepNumberText}>
                  {cookingStepIndex + 1}
                </Text>
              </View>
              <Text style={styles.cookingText}>
                {dish.steps[cookingStepIndex]}
              </Text>
              {cookingStepCompleted ? (
                <CheckCircle2
                  color={colors.primary}
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
            <Text style={styles.tapHint}>
              마쳤다면 카드를 눌러 체크하거나, 아래에서 바로 다음으로 갈 수
              있어요.
            </Text>
            {dish.tips.length ? (
              <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>장고의 조리 팁</Text>
                <Text style={styles.tipBody}>{dish.tips.join(" ")}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {currentIndex === consumptionStepIndex ? (
          <View style={styles.section}>
            <Text style={styles.sectionHint}>
              실제로 쓴 양과 다르면 재료별로 바로 바꿀 수 있어요.
            </Text>
            <Pressable
              onPress={handleToggleFavorite}
              disabled={setFavoriteMutation.isPending}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: isFavorite,
                disabled: setFavoriteMutation.isPending,
              }}
              accessibilityLabel={
                isFavorite
                  ? `${dish.title} 즐겨찾기에서 빼기`
                  : `${dish.title} 즐겨찾기에 추가`
              }
              style={({ pressed }) => [
                styles.favoriteCard,
                isFavorite && styles.favoriteCardSelected,
                pressed && styles.pressed,
                setFavoriteMutation.isPending && styles.favoriteCardPending,
              ]}
            >
              <View
                style={[
                  styles.favoriteIcon,
                  isFavorite && styles.favoriteIconSelected,
                ]}
              >
                <Heart
                  color={isFavorite ? colors.primary : colors.subtext}
                  fill={isFavorite ? colors.primary : "none"}
                  size={spacing.md}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {isFavorite
                    ? "즐겨찾기에 담아뒀어요"
                    : "이 요리, 다음에도 쉽게 찾을까요?"}
                </Text>
                <Text style={styles.rowDescription}>
                  {isFavorite
                    ? "추천 탭에서 언제든 다시 볼 수 있어요."
                    : "하트를 눌러 즐겨찾기에 담아두세요."}
                </Text>
              </View>
              <Text
                style={[
                  styles.favoriteAction,
                  isFavorite && styles.favoriteActionSelected,
                ]}
              >
                {isFavorite ? "담았어요" : "담기"}
              </Text>
            </Pressable>
            {favoriteMutationError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  즐겨찾기를 바꾸지 못했어요. 잠시 뒤 다시 눌러주세요.
                </Text>
              </View>
            ) : null}
            {inventoryQuery.isError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  앗, 냉장고의 최신 상태를 불러오지 못했어요.
                </Text>
              </View>
            ) : null}
            <View style={styles.list}>
              {consumableIngredients.map((ingredient) => (
                <ConsumptionCard
                  key={ingredient.inventoryItemId}
                  ingredient={ingredient}
                  choice={
                    consumptionChoices[ingredient.inventoryItemId] ?? {
                      mode: "skip",
                      amountBase: 0,
                    }
                  }
                  onChange={(choice) =>
                    setConsumptionChoices((current) => ({
                      ...current,
                      [ingredient.inventoryItemId]: choice,
                    }))
                  }
                />
              ))}
            </View>
            {!inventoryQuery.isPending && !consumableIngredients.length ? (
              <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>이번에는 직접 정리해 주세요</Text>
                <Text style={styles.tipBody}>
                  추천을 받은 뒤 재고 상태가 달라져 자동으로 연결할 재료가
                  없어요.
                </Text>
              </View>
            ) : null}
            {mutationError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{mutationError}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </StepFlow>
    </Screen>
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
  const available = ingredient.item.quantityBase;
  const selectMode = (mode: ConsumptionMode) => {
    onChange({
      mode,
      amountBase: resolveConsumptionAmount(
        mode,
        available,
        ingredient.recommendedAmountBase,
      ),
    });
  };

  return (
    <View style={styles.consumptionCard}>
      <View style={styles.consumptionHeader}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{ingredient.name}</Text>
          <Text style={styles.rowDescription}>
            지금 {formatBaseQuantity(available, ingredient.item.unitCode)}{" "}
            있어요
          </Text>
        </View>
        {choice.amountBase > 0 ? (
          <Text style={styles.selectedAmount}>
            {formatBaseQuantity(choice.amountBase, ingredient.item.unitCode)}
          </Text>
        ) : null}
      </View>
      <View style={styles.pillRow}>
        {ingredient.recommendedAmountBase ? (
          <Pill
            label={`추천량 ${formatBaseQuantity(
              ingredient.recommendedAmountBase,
              ingredient.item.unitCode,
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
          label={`사용할 양 (${unitLabel(ingredient.item.unitCode)})`}
          value={choice.amountBase}
          max={available}
          onChange={(amountBase) =>
            onChange({
              mode: "custom",
              amountBase: Math.min(amountBase, available),
            })
          }
        />
      ) : null}
    </View>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionHint: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  list: {
    gap: spacing.sm,
  },
  checkRow: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    opacity: 0.72,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  rowDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  safetyCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  safetyTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  safetyBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  cookingCard: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cookingCardCompleted: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  stepNumber: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.surface,
  },
  cookingText: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  tapHint: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.mutedText,
    textAlign: "center",
  },
  tipCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tipTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  tipBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  favoriteCard: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  favoriteCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  favoriteCardPending: {
    opacity: 0.55,
  },
  favoriteIcon: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteIconSelected: {
    backgroundColor: colors.surface,
  },
  favoriteAction: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  favoriteActionSelected: {
    color: colors.primary,
  },
  consumptionCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  consumptionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  selectedAmount: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
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
  errorText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.danger,
  },
  remainingCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  remainingRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  remainingName: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  remainingAmount: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
});
