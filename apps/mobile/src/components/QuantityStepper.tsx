import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

interface QuantityStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

export function QuantityStepper({
  label,
  value,
  onChange,
  error,
}: QuantityStepperProps) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 1;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.container, error ? styles.errorContainer : null]}>
        <Pressable
          onPress={() => onChange(Math.max(1, safeValue - 1))}
          hitSlop={spacing.xxs}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Text style={styles.iconButtonLabel}>-</Text>
        </Pressable>
        <TextInput
          value={String(safeValue)}
          onChangeText={(text) => {
            const nextValue = Number(text.replace(/[^0-9]/g, ""));
            onChange(nextValue > 0 ? nextValue : 1);
          }}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Pressable
          onPress={() => onChange(safeValue + 1)}
          hitSlop={spacing.xxs}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
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
    fontWeight: typography.label.fontWeight,
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
  iconButtonLabel: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.primary,
  },
  input: {
    flex: 1,
    alignSelf: "stretch",
    minHeight: touchTarget.ctaLarge,
    textAlign: "center",
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
  errorText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.bodySmall.fontWeight,
    color: colors.danger,
  },
});
