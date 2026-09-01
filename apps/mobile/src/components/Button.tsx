import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radius, spacing, controlSize } from "../shared/theme";
import { AppText } from "./AppText";

interface ButtonProps extends PropsWithChildren {
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "surface";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  size?: "medium" | "small";
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
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
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const palette = buttonPalettes[variant];
  const isDisabled = disabled || loading;
  const iconSize = size === "small" ? spacing.sm : spacing.sm + spacing.xxs;
  const textColor = isDisabled ? palette.disabledTextColor : palette.textColor;
  const label = (
    <AppText
      variant={size === "small" ? "bodySmall" : "bodyStrong"}
      scaleRole="body"
      style={[styles.label, { color: textColor }]}
    >
      {children}
    </AppText>
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
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (typeof children === "string" ? children : undefined)
      }
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        size === "small" ? styles.smallButton : styles.mediumButton,
        fullWidth && styles.fullWidth,
        (variant === "surface" || (variant === "danger" && !isDisabled)) &&
          styles.outlined,
        variant === "danger" && !isDisabled && styles.dangerOutline,
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
    backgroundColor: colors.actionPrimaryBackground,
    pressedBackgroundColor: colors.actionPrimaryPressed,
    disabledBackgroundColor: colors.disabled,
    textColor: colors.actionPrimaryForeground,
    disabledTextColor: colors.disabledText,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    pressedBackgroundColor: colors.primarySoftPressed,
    disabledBackgroundColor: colors.mutedSurface,
    textColor: colors.primaryForeground,
    disabledTextColor: colors.disabledText,
  },
  /** White fill + danger border — stays visible on soft-tinted hero cards. */
  danger: {
    backgroundColor: colors.surface,
    pressedBackgroundColor: colors.dangerSoft,
    disabledBackgroundColor: colors.mutedSurface,
    textColor: colors.dangerForeground,
    disabledTextColor: colors.disabledText,
  },
  /** White surface — use on soft-tinted cards so the control doesn't blend in. */
  surface: {
    backgroundColor: colors.surface,
    pressedBackgroundColor: colors.surfacePressed,
    disabledBackgroundColor: colors.mutedSurface,
    textColor: colors.primaryForeground,
    disabledTextColor: colors.disabledText,
  },
};

const styles = StyleSheet.create({
  base: {
    minWidth: 0,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  mediumButton: {
    minHeight: controlSize.cta,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  smallButton: {
    minHeight: controlSize.minimum,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.borderControl,
  },
  dangerOutline: {
    borderColor: colors.dangerForeground,
  },
  label: {
    flexShrink: 1,
    textAlign: "center",
  },
});
