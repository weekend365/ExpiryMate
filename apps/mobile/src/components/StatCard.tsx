import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { AppText } from "./AppText";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger" | "success";
  /** `inline` = open metric strip (preferred under a hero). `card` = bordered tile. */
  variant?: "card" | "inline";
}

export function StatCard({
  label,
  value,
  tone = "default",
  variant = "card",
}: StatCardProps) {
  const toneStyle = tones[tone];
  const isInline = variant === "inline";

  return (
    <View
      style={[
        isInline ? styles.inline : styles.card,
        !isInline && {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <AppText
        variant={isInline ? "heading" : "display"}
        style={{ color: toneStyle.valueColor }}
      >
        {value}
      </AppText>
      <AppText
        variant={isInline ? "caption" : "bodySmall"}
        tone="subtext"
        style={!isInline ? { color: toneStyle.labelColor } : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

const tones = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    valueColor: colors.text,
    labelColor: colors.subtext,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
    valueColor: colors.warning,
    labelColor: colors.subtext,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    valueColor: colors.danger,
    labelColor: colors.subtext,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
    valueColor: colors.success,
    labelColor: colors.subtext,
  },
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: spacing.xxxl + spacing.xl,
  },
  inline: {
    flex: 1,
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    alignItems: "flex-start",
  },
});
