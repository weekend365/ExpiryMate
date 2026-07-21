import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../shared/theme";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger" | "success";
}

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  const toneStyle = tones[tone];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <Text style={[styles.value, { color: toneStyle.valueColor }]}>{value}</Text>
      <Text style={[styles.label, { color: toneStyle.labelColor }]}>{label}</Text>
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
  value: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontFamily: typography.display.fontFamily,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
  },
});
