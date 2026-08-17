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
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
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
        step === "partial" ? "얼마나 썼어요?" : "어떻게 정리할까요?"
      }
      description={
        item
          ? step === "partial"
            ? `2단계 중 2단계 · 지금 ${formatInventoryQuantity(item)} 있어요`
            : canPartial
              ? `2단계 중 1단계 · ${item.displayName} · ${formatDateKoreanCompact(item.expiryDate)}까지`
              : `${item.displayName} · ${formatDateKoreanCompact(item.expiryDate)}까지`
          : undefined
      }
      footer={
        step === "partial" && item ? (
          <View style={styles.partialFooter}>
            <Button variant="secondary" onPress={() => setStep("choose")} fullWidth>
              다시 고를게요
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
              {consumesAll ? "전부 빼 둘게요" : "이만큼 빼 둘게요"}
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
          <Text style={styles.remainingHint}>
            {consumesAll
              ? "쓴 양만큼이면 보관함에서 빼 둘게요"
              : `빼면 ${formatBaseQuantity(remainingAfter, item.unitCode)} 남아요`}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            onPress={() => item && onConsumeAll(item)}
            accessibilityRole="button"
            accessibilityLabel="모두 정리"
            accessibilityHint="남은 양을 전부 보관함에서 빼 둬요."
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
              <Text style={styles.optionTitle}>모두 정리</Text>
              <Text style={styles.optionDescription}>
                남은 걸 전부 빼 둘게요
              </Text>
            </View>
          </Pressable>
          {canPartial ? (
            <Pressable
              onPress={() => setStep("partial")}
              accessibilityRole="button"
              accessibilityLabel="부분 정리"
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
                <Text style={styles.optionTitle}>부분 정리</Text>
                <Text style={styles.optionDescription}>
                  쓴 만큼만 빼 둘게요
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.xs,
  },
  option: {
    minHeight: touchTarget.cta,
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
    width: touchTarget.icon,
    height: touchTarget.icon,
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
