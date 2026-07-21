import type { PropsWithChildren } from "react";
import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from "react-native";
import { colors, typography, type AppTextStyle } from "../shared/theme";

export type AppTextVariant = keyof typeof typography;

type AppTextTone = "default" | "subtext" | "muted" | "primary" | "danger" | "warning" | "success" | "inverse";

interface AppTextProps extends PropsWithChildren {
  variant?: AppTextVariant;
  tone?: AppTextTone;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: TextProps["accessibilityRole"];
}

const toneColors: Record<AppTextTone, string> = {
  default: colors.text,
  subtext: colors.subtext,
  muted: colors.mutedText,
  primary: colors.primary,
  danger: colors.danger,
  warning: colors.warning,
  success: colors.success,
  inverse: colors.surface,
};

/**
 * Apply a typography token as a whole set — never borrow only `fontFamily`
 * from a heavier token (e.g. title) for smaller body copy.
 */
export function textStyle(variant: AppTextVariant): AppTextStyle {
  return typography[variant];
}

export function AppText({
  children,
  variant = "body",
  tone = "default",
  numberOfLines,
  style,
  accessibilityRole,
}: AppTextProps) {
  return (
    <Text
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[textStyle(variant), { color: toneColors[tone] }, style]}
    >
      {children}
    </Text>
  );
}
