import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors, spacing } from "../shared/theme";

interface ButtonProps extends PropsWithChildren {
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: ButtonProps) {
  const palette = buttonPalettes[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.backgroundColor,
          opacity: pressed || disabled ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.textColor} />
      ) : (
        <Text style={[styles.label, { color: palette.textColor }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const buttonPalettes = {
  primary: {
    backgroundColor: colors.primary,
    textColor: colors.surface,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    textColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    textColor: colors.danger,
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
});
