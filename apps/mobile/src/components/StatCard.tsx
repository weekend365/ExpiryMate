import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../shared/theme";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger";
}

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  const toneStyle = tones[tone];

  return (
    <View style={[styles.card, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.value, { color: toneStyle.valueColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const tones = {
  default: {
    backgroundColor: colors.surface,
    valueColor: colors.text,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    valueColor: colors.warning,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    valueColor: colors.danger,
  },
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: spacing.xxxl + spacing.xl,
  },
  value: {
    fontSize: typography.display.fontSize,
    lineHeight: typography.display.lineHeight,
    fontWeight: typography.display.fontWeight,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodySmall.fontWeight,
    color: colors.subtext,
  },
});
