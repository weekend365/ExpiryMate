import { Pressable, StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radius, spacing, typography } from "../shared/theme";
import { AppText } from "./AppText";

interface PillProps {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  count?: number;
  tone?: "default" | "warning" | "danger" | "success";
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Vertical inset so a 40px chip still meets the 48px touch target. */
const CHIP_HIT_SLOP = {
  top: spacing.xxs,
  bottom: spacing.xxs,
  left: 0,
  right: 0,
} as const;

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
      hitSlop={CHIP_HIT_SLOP}
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
        <View style={styles.iconSlot}>
          <Icon color={foregroundColor} size={spacing.sm} strokeWidth={2.4} />
        </View>
      ) : null}
      <AppText
        variant="bodySmall"
        scaleRole="chrome"
        densityAware={false}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.label, { color: foregroundColor }]}
      >
        {label}
      </AppText>
      {typeof count === "number" ? (
        <AppText
          variant="caption"
          scaleRole="chrome"
          densityAware={false}
          numberOfLines={1}
          style={[
            styles.count,
            {
              backgroundColor: countBackgroundColor,
              color: countTextColor,
            },
          ]}
        >
          {count}
        </AppText>
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
} as const;

const styles = StyleSheet.create({
  base: {
    // Selection chip: keep icon + label on one row; grow horizontally in wrap grids.
    minHeight: spacing.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: spacing.xs,
  },
  iconSlot: {
    flexShrink: 0,
  },
  label: {
    flexShrink: 1,
    fontFamily: typography.label.fontFamily,
  },
  count: {
    flexShrink: 0,
    minWidth: spacing.md,
    overflow: "hidden",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    textAlign: "center",
    fontFamily: typography.title.fontFamily,
  },
});
