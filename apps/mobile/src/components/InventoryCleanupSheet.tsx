import {
  canPartiallyConsumeInventoryItem,
  defaultPartialConsumeAmount,
  formatBaseQuantity,
  formatDateKoreanCompact,
  formatInventoryQuantity,
  quantityInputStep,
  unitCodeLabels,
  type InventoryItem,
} from "@expirymate/shared";
import { CheckCircle2, Minus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, controlSize, typography } from "../shared/theme";
import { AppText } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { QuantityStepper } from "./QuantityStepper";

type CleanupStep = "choose" | "partial";

interface InventoryCleanupSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
  onConsumeAll: (item: InventoryItem) => void;
  onConsumePartial: (item: InventoryItem, amountBase: number) => void;
}

export function InventoryCleanupSheet({
  item,
  onClose,
  onConsumeAll,
  onConsumePartial,
}: InventoryCleanupSheetProps) {
  const [step, setStep] = useState<CleanupStep>("choose");
  const [amountBase, setAmountBase] = useState(1);
  const canPartial = item ? canPartiallyConsumeInventoryItem(item) : false;

  useEffect(() => {
    if (!item) {
      setStep("choose");
      setAmountBase(1);
      return;
    }

    setStep("choose");
    setAmountBase(defaultPartialConsumeAmount(item));
  }, [item]);

  const closeSheet = () => {
    setStep("choose");
    onClose();
  };

  const remainingAfter =
    item === null ? 0 : Math.max(0, item.quantityBase - amountBase);
  const consumesAll = Boolean(item && amountBase >= item.quantityBase);
  const unitLabel = item ? unitCodeLabels[item.unitCode] : "개";

  return (
    <BottomSheet
      visible={item !== null}
      onClose={closeSheet}
      title={
        step === "partial" ? "얼마나 썼어요?" : "얼마나 사용했나요?"
      }
      description={
        item
          ? step === "partial"
            ? `2단계 중 2단계 · 지금 ${formatInventoryQuantity(item)} 있어요`
            : canPartial
              ? `2단계 중 1단계 · ${item.displayName} · ${formatCleanupExpiry(item.expiryDate)}`
              : `${item.displayName} · ${formatCleanupExpiry(item.expiryDate)}`
          : undefined
      }
      footer={
        step === "partial" && item ? (
          <View style={styles.partialFooter}>
            <Button variant="secondary" onPress={() => setStep("choose")} fullWidth>
          다시 선택
            </Button>
            <Button
              onPress={() => {
                if (consumesAll) {
                  onConsumeAll(item);
                  return;
                }

                onConsumePartial(item, amountBase);
              }}
              fullWidth
              testID="inventory-cleanup-partial-confirm-button"
            >
          {consumesAll ? "전부 사용" : "선택 수량 사용"}
            </Button>
          </View>
        ) : undefined
      }
    >
      {item && step === "partial" ? (
        <View style={styles.partialStep}>
          <QuantityStepper
            label={`쓴 양 (${unitLabel})`}
            value={amountBase}
            max={item.quantityBase}
            step={quantityInputStep(unitLabel)}
            onChange={setAmountBase}
          />
          <AppText style={styles.remainingHint}>
            {consumesAll
              ? "쓴 양만큼이면 보관함에서 빼 둘게요"
              : `빼면 ${formatBaseQuantity(remainingAfter, item.unitCode)} 남아요`}
          </AppText>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={() => item && onConsumeAll(item)}
            accessibilityRole="button"
            accessibilityLabel="전부 사용"
            accessibilityHint="남은 양을 전부 사용한 것으로 기록해요."
            testID="inventory-cleanup-all-button"
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <View style={styles.optionIcon}>
              <CheckCircle2
                color={colors.primary}
                size={spacing.md}
                strokeWidth={2.4}
              />
            </View>
            <View style={styles.optionCopy}>
              <AppText style={styles.optionTitle}>전부 사용</AppText>
              <AppText style={styles.optionDescription}>
                남은 양을 보관함에서 빼요
              </AppText>
            </View>
          </Pressable>
          {canPartial ? (
            <Pressable
              onPress={() => setStep("partial")}
              accessibilityRole="button"
              accessibilityLabel="일부 사용"
              accessibilityHint="쓴 만큼만 빼고 나머지는 그대로 둬요."
              testID="inventory-cleanup-partial-button"
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <Minus
                  color={colors.primary}
                  size={spacing.md}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.optionCopy}>
                <AppText style={styles.optionTitle}>일부 사용</AppText>
                <AppText style={styles.optionDescription}>
                  쓴 만큼만 빼 둘게요
                </AppText>
              </View>
            </Pressable>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

function formatCleanupExpiry(expiryDate: string | null) {
  return expiryDate
    ? `${formatDateKoreanCompact(expiryDate)}까지`
    : "기한 확인 필요";
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.xs,
  },
  option: {
    minHeight: controlSize.cta,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  optionIcon: {
    width: controlSize.icon,
    height: controlSize.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  optionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  optionDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  partialStep: {
    gap: spacing.sm,
  },
  remainingHint: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  partialFooter: {
    gap: spacing.sm,
  },
});
