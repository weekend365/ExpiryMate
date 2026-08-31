import type { RecipeInventorySnapshotItem, RecipeRecommendationDish } from "@expirymate/shared";
import { Clock3, ShoppingBasket, Utensils } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { OptionalMissingIngredientsCard } from "../affiliate/optional-missing-ingredients";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import {
  colors,
  radius,
  spacing,
  controlSize,
  typography,
} from "../../shared/theme";
import {
  formatDishMeta,
  formatIngredientDdayLabel,
  getUsedIngredientRows,
  type RecipeDetailSelection,
} from "./recipe-detail";
import {
  AffiliateEntryImpression,
  trackAffiliateEntryTap,
} from "../affiliate/affiliate-entry-tracking";

export function RecipeDetailSheet({
  selection,
  onClose,
  onStartCooking,
  onOpenShopping,
}: {
  selection: RecipeDetailSelection | null;
  onClose: () => void;
  onStartCooking: () => void;
  onOpenShopping: (query?: string) => void;
}) {
  return (
    <BottomSheet
      visible={Boolean(selection)}
      onClose={onClose}
      title={selection?.dish.title ?? "요리 자세히 보기"}
      description={
        selection
          ? formatDishMeta(selection.dish)
          : "요리 방법을 함께 살펴볼까요?"
      }
      footer={
        <View style={styles.footerStack}>
          {selection?.dish.optionalMissingIngredients.length ? (
            <AffiliateEntryImpression placement="recipe_optional_entry">
              <Button
                icon={ShoppingBasket}
                variant="surface"
                onPress={() => {
                  trackAffiliateEntryTap("recipe_optional_entry");
                  onOpenShopping(
                    selection.dish.optionalMissingIngredients[0]?.name,
                  );
                }}
                fullWidth
              >
                있으면 좋은 재료 {selection.dish.optionalMissingIngredients.length}개
                장보기
              </Button>
            </AffiliateEntryImpression>
          ) : null}
          <Button
            icon={Utensils}
            onPress={onStartCooking}
            disabled={!selection}
            fullWidth
          >
            이 요리 시작
          </Button>
        </View>
      }
    >
      {selection ? (
        <RecipeDetailContent
          dish={selection.dish}
          inventorySnapshot={selection.inventorySnapshot}
          recommendationId={selection.recommendationId}
          dishIndex={selection.dishIndex}
          onOpenShopping={onOpenShopping}
        />
      ) : null}
    </BottomSheet>
  );
}

function RecipeDetailContent({
  dish,
  inventorySnapshot,
  recommendationId,
  dishIndex,
  onOpenShopping,
}: {
  dish: RecipeRecommendationDish;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  recommendationId: string;
  dishIndex: number;
  onOpenShopping: (query?: string) => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  const usedIngredientRows = getUsedIngredientRows(dish, inventorySnapshot);

  return (
    <>
      <AppText style={styles.recipeDetailSummary}>{dish.summary}</AppText>

      <View style={styles.recipeBlock}>
        <AppText style={styles.blockTitle}>사용할 재료</AppText>
        {usedIngredientRows.length > 0 ? (
          <View style={styles.ingredientInfoList}>
            {usedIngredientRows.map((ingredient) => (
              <View
                key={ingredient.key}
                style={[
                  styles.ingredientInfoRow,
                  shouldStack && styles.ingredientInfoRowStacked,
                ]}
              >
                <View
                  style={[
                    styles.ingredientInfoCopy,
                    shouldStack && styles.ingredientInfoCopyStacked,
                  ]}
                >
                  <AppText style={styles.ingredientInfoName}>
                    {ingredient.name}
                  </AppText>
                  {ingredient.amountLabel ? (
                    <AppText style={styles.ingredientInfoAmount}>
                      추천 {ingredient.amountLabel}
                    </AppText>
                  ) : null}
                </View>
                {ingredient.daysUntilExpiry !== null ? (
                  <View
                    style={[
                      styles.ingredientExpiryBadge,
                      ingredient.isExpiring
                        ? styles.ingredientExpiryBadgeExpiring
                        : styles.ingredientExpiryBadgeSafe,
                    ]}
                    accessibilityLabel={`유통기한 ${
                      formatIngredientDdayLabel(ingredient.daysUntilExpiry) ??
                      "임박"
                    }`}
                  >
                    <Clock3
                      color={
                        ingredient.isExpiring ? colors.warning : colors.success
                      }
                      size={spacing.sm}
                      strokeWidth={2.4}
                    />
                    <AppText
                      style={[
                        styles.ingredientExpiryBadgeText,
                        ingredient.isExpiring
                          ? styles.ingredientExpiryBadgeTextExpiring
                          : styles.ingredientExpiryBadgeTextSafe,
                      ]}
                    >
                      {formatIngredientDdayLabel(ingredient.daysUntilExpiry) ??
                        "임박"}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <AppText style={styles.blockHint}>표시할 재료 정보가 없어요.</AppText>
        )}
      </View>

      <OptionalMissingIngredientsCard
        dish={dish}
        recommendationId={recommendationId}
        dishIndex={dishIndex}
        onOpenShopping={onOpenShopping}
      />

      <View style={styles.recipeBlock}>
        <AppText style={styles.blockTitle}>조리 순서</AppText>
        <View style={styles.stepList}>
          {dish.steps.map((step, stepIndex) => (
            <View
              key={`${dish.title}-step-${stepIndex}`}
              style={styles.stepCard}
            >
              <View style={styles.stepBadge}>
                <AppText style={styles.stepBadgeText}>{stepIndex + 1}</AppText>
              </View>
              <AppText style={styles.stepText}>{step}</AppText>
            </View>
          ))}
        </View>
      </View>

      {dish.tips.length > 0 ? (
        <View style={styles.softNoteCard}>
          <AppText style={styles.softNoteTitle}>팁</AppText>
          <AppText style={styles.softNoteBody}>{dish.tips.join(" ")}</AppText>
        </View>
      ) : null}

      {dish.safetyNote ? (
        <View style={styles.safetyCard}>
          <AppText style={styles.safetyCardTitle}>안전하게 챙기기</AppText>
          <AppText style={styles.safetyCardBody}>{dish.safetyNote}</AppText>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  footerStack: {
    gap: spacing.xs,
  },
  recipeDetailSummary: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  recipeBlock: {
    gap: spacing.xs,
  },
  blockTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  blockHint: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  ingredientInfoList: {
    gap: spacing.xs,
  },
  ingredientInfoRow: {
    minHeight: controlSize.minimum,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ingredientInfoRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  ingredientInfoCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ingredientInfoCopyStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  ingredientInfoName: {
    flexShrink: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  ingredientInfoAmount: {
    flexShrink: 0,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  ingredientExpiryBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  ingredientExpiryBadgeSafe: {
    backgroundColor: colors.successSoft,
  },
  ingredientExpiryBadgeExpiring: {
    backgroundColor: colors.warningSoft,
  },
  ingredientExpiryBadgeText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  ingredientExpiryBadgeTextSafe: {
    color: colors.success,
  },
  ingredientExpiryBadgeTextExpiring: {
    color: colors.warning,
  },
  softNoteCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  softNoteTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  softNoteBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  stepList: {
    gap: spacing.sm,
  },
  stepCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.surface,
  },
  stepText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  safetyCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  safetyCardTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.warning,
  },
  safetyCardBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
});
