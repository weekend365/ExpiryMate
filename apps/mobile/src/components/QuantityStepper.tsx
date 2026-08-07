import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

interface QuantityStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Inclusive upper bound for cooking / partial-use flows. */
  max?: number;
  error?: string;
}

export function QuantityStepper({
  label,
  value,
  onChange,
  max,
  error,
}: QuantityStepperProps) {
  const upperBound =
    typeof max === "number" && Number.isFinite(max) && max >= 1
      ? Math.floor(max)
      : undefined;
  const safeValue = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  const clampedValue =
    upperBound === undefined ? safeValue : Math.min(safeValue, upperBound);

  return (
    <View style={styles.wrapper}>
      <AppText variant="bodySmall" scaleRole="body" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.container, error ? styles.errorContainer : null]}>
        <Pressable
          onPress={() => onChange(Math.max(1, clampedValue - 1))}
          hitSlop={spacing.xxs}
          accessibilityRole="button"
          accessibilityLabel={`${label} 하나 줄이기`}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <AppText
            variant="heading"
            scaleRole="chrome"
            densityAware={false}
            style={styles.iconButtonLabel}
          >
            -
          </AppText>
        </Pressable>
        <AppTextInput
          value={String(clampedValue)}
          onChangeText={(text) => {
            const nextValue = Number(text.replace(/[^0-9]/g, ""));
            const normalized = nextValue > 0 ? nextValue : 1;
            onChange(
              upperBound === undefined
                ? normalized
                : Math.min(normalized, upperBound),
            );
          }}
          keyboardType="number-pad"
          accessibilityLabel={`${label} 수량`}
          scaleRole="chrome"
          style={styles.input}
        />
        <Pressable
          onPress={() =>
            onChange(
              upperBound === undefined
                ? clampedValue + 1
                : Math.min(clampedValue + 1, upperBound),
            )
          }
          hitSlop={spacing.xxs}
          accessibilityRole="button"
          accessibilityLabel={`${label} 하나 늘리기`}
          disabled={upperBound !== undefined && clampedValue >= upperBound}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
            upperBound !== undefined &&
              clampedValue >= upperBound &&
              styles.iconButtonDisabled,
          ]}
        >
          <AppText
            variant="heading"
            scaleRole="chrome"
            densityAware={false}
            style={styles.iconButtonLabel}
          >
            +
          </AppText>
        </Pressable>
      </View>
      {error ? (
        <AppText variant="label" tone="danger" densityAware={false}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.label.fontFamily,
  },
  container: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  errorContainer: {
    borderColor: colors.danger,
  },
  iconButton: {
    minWidth: touchTarget.ctaLarge,
    minHeight: touchTarget.ctaLarge,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.primarySoft,
  },
  iconButtonPressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonLabel: {
    color: colors.primary,
  },
  input: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    minHeight: touchTarget.ctaLarge,
    textAlign: "center",
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
});
