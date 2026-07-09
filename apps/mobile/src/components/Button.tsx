import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radius, spacing } from "../shared/theme";

interface ButtonProps extends PropsWithChildren {
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  size?: "medium" | "small";
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  icon: Icon,
  iconPosition = "left",
  size = "medium",
  fullWidth,
  disabled,
  loading,
  style,
}: ButtonProps) {
  const palette = buttonPalettes[variant];
  const isDisabled = disabled || loading;
  const iconSize = size === "small" ? 16 : 18;
  const textColor = isDisabled ? palette.disabledTextColor : palette.textColor;
  const label = (
    <Text
      style={[
        styles.label,
        size === "small" ? styles.smallLabel : styles.mediumLabel,
        { color: textColor },
      ]}
    >
      {children}
    </Text>
  );
  const icon = Icon ? (
    <Icon
      color={textColor}
      size={iconSize}
      strokeWidth={2.4}
    />
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === "small" ? styles.smallButton : styles.mediumButton,
        fullWidth && styles.fullWidth,
        { backgroundColor: pressed ? palette.pressedBackgroundColor : palette.backgroundColor },
        isDisabled && {
          backgroundColor: palette.disabledBackgroundColor,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <>
          {iconPosition === "left" ? icon : null}
          {label}
          {iconPosition === "right" ? icon : null}
        </>
      )}
    </Pressable>
  );
}

const buttonPalettes = {
  primary: {
    backgroundColor: colors.primary,
    pressedBackgroundColor: colors.primaryPressed,
    disabledBackgroundColor: colors.disabled,
    textColor: colors.surface,
    disabledTextColor: colors.surface,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    pressedBackgroundColor: colors.primarySoftPressed,
    disabledBackgroundColor: colors.mutedSurface,
    textColor: colors.primary,
    disabledTextColor: colors.disabledText,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    pressedBackgroundColor: colors.dangerSoftPressed,
    disabledBackgroundColor: colors.mutedSurface,
    textColor: colors.danger,
    disabledTextColor: colors.disabledText,
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  mediumButton: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  smallButton: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  label: {
    fontWeight: "700",
  },
  mediumLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
  smallLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
