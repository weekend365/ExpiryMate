import type { PropsWithChildren } from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from "react-native";
import {
  fontScaleRoleForVariant,
  getMaxFontSizeMultiplier,
  inferTypographyVariant,
  resolveTypographyVariant,
  type AppTextVariant,
  type FontScaleRole,
} from "../shared/font-scale";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { colors, typography, type AppTextStyle } from "../shared/theme";

export type { AppTextVariant };

type AppTextTone =
  | "default"
  | "subtext"
  | "muted"
  | "primary"
  | "danger"
  | "warning"
  | "success"
  | "inverse";

export interface AppTextProps
  extends PropsWithChildren,
    Omit<TextProps, "children" | "numberOfLines" | "style"> {
  variant?: AppTextVariant;
  tone?: AppTextTone;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  /**
   * Font-scale cap role. Defaults from `variant`; use `chrome` for badges,
   * tab labels, and other dense UI copy.
   */
  scaleRole?: FontScaleRole;
  /** When false, skip large-text typography downshift. */
  densityAware?: boolean;
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
  variant,
  tone = "default",
  numberOfLines,
  style,
  scaleRole,
  densityAware = true,
  maxFontSizeMultiplier,
  ...textProps
}: AppTextProps) {
  const { textDensity } = useResponsiveLayout();
  const flattenedStyle = StyleSheet.flatten(style);
  const inferredVariant = inferTypographyVariant(
    flattenedStyle?.fontSize,
    flattenedStyle?.lineHeight,
  );
  const requestedVariant = variant ?? inferredVariant ?? "body";
  const resolvedVariant = densityAware
    ? resolveTypographyVariant(requestedVariant, textDensity)
    : requestedVariant;
  const role = scaleRole ?? fontScaleRoleForVariant(resolvedVariant);
  const visualStyle =
    !variant && inferredVariant ? omitTypographyMetrics(flattenedStyle) : style;

  return (
    <Text
      {...textProps}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={
        maxFontSizeMultiplier ?? getMaxFontSizeMultiplier(role)
      }
      style={[
        textStyle(resolvedVariant),
        { color: toneColors[tone] },
        visualStyle,
      ]}
    >
      {children}
    </Text>
  );
}

function omitTypographyMetrics(style?: TextStyle): TextStyle | undefined {
  if (!style) {
    return undefined;
  }

  const visualStyle = { ...style };
  delete visualStyle.fontSize;
  delete visualStyle.lineHeight;
  return visualStyle;
}
