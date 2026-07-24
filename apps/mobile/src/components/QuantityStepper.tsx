import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

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
      <Text style={styles.label}>{label}</Text>
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
          <Text style={styles.iconButtonLabel}>-</Text>
        </Pressable>
        <TextInput
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
          <Text style={styles.iconButtonLabel}>+</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
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
    width: touchTarget.ctaLarge,
    minHeight: touchTarget.ctaLarge,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  iconButtonPressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonLabel: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  input: {
    flex: 1,
    alignSelf: "stretch",
    minHeight: touchTarget.ctaLarge,
    textAlign: "center",
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  errorText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.danger,
  },
});
