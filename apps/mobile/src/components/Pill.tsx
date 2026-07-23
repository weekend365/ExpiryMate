import { Pressable, StyleSheet, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

interface PillProps {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  count?: number;
  tone?: "default" | "warning" | "danger" | "success";
  onPress: () => void;
  accessibilityLabel?: string;
}

export function Pill({
  label,
  selected,
  icon: Icon,
  count,
  tone = "default",
  onPress,
  accessibilityLabel,
}: PillProps) {
  const palette = tonePalettes[tone];
  const foregroundColor = selected ? colors.surface : palette.textColor;
  const countBackgroundColor = selected ? colors.surface : colors.mutedSurface;
  const countTextColor = selected ? palette.selectedBackgroundColor : foregroundColor;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (typeof count === "number" ? `${label}, ${count}개` : label)
      }
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected
            ? palette.selectedBackgroundColor
            : pressed
              ? colors.surfacePressed
              : colors.surface,
          borderColor: selected ? palette.selectedBackgroundColor : colors.border,
        },
      ]}
    >
      {Icon ? (
        <Icon color={foregroundColor} size={spacing.sm} strokeWidth={2.4} />
      ) : null}
      <Text style={[styles.label, { color: foregroundColor }]}>
        {label}
      </Text>
      {typeof count === "number" ? (
        <Text
          style={[
            styles.count,
            {
              backgroundColor: countBackgroundColor,
              color: countTextColor,
            },
          ]}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

const tonePalettes = {
  default: {
    selectedBackgroundColor: colors.primary,
    textColor: colors.text,
  },
  warning: {
    selectedBackgroundColor: colors.warning,
    textColor: colors.warning,
  },
  danger: {
    selectedBackgroundColor: colors.danger,
    textColor: colors.danger,
  },
  success: {
    selectedBackgroundColor: colors.success,
    textColor: colors.success,
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
  },
  count: {
    minWidth: spacing.md,
    overflow: "hidden",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    textAlign: "center",
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
  },
});
