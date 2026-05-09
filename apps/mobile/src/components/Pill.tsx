import { Pressable, StyleSheet, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "../shared/theme";

interface PillProps {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  count?: number;
  tone?: "default" | "warning" | "danger" | "success";
  onPress: () => void;
}

export function Pill({
  label,
  selected,
  icon: Icon,
  count,
  tone = "default",
  onPress,
}: PillProps) {
  const palette = tonePalettes[tone];
  const foregroundColor = selected ? colors.surface : palette.textColor;

  return (
    <Pressable
      onPress={onPress}
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
        <Icon color={foregroundColor} size={15} strokeWidth={2.4} />
      ) : null}
      <Text style={[styles.label, { color: foregroundColor }]}>
        {label}
      </Text>
      {typeof count === "number" ? (
        <Text
          style={[
            styles.count,
            {
              backgroundColor: selected ? "rgba(255,255,255,0.2)" : colors.mutedSurface,
              color: foregroundColor,
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
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  count: {
    minWidth: 20,
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
