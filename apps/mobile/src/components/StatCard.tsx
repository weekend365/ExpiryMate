import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../shared/theme";

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
    borderRadius: 22,
    padding: spacing.md,
    gap: 6,
    minHeight: 110,
  },
  value: {
    fontSize: 30,
    fontWeight: "800",
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.subtext,
  },
});
