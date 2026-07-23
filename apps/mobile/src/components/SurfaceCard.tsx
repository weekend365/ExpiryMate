import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../shared/theme";

export type SurfaceVariant = "hero" | "card" | "inline";

interface SurfaceCardProps extends PropsWithChildren {
  /** hero = one focus surface per screen; card = bordered section; inline = open/no chrome */
  variant?: SurfaceVariant;
  tone?: "default" | "primary" | "danger" | "warning" | "success" | "muted";
  style?: StyleProp<ViewStyle>;
}

const toneBackground: Record<
  NonNullable<SurfaceCardProps["tone"]>,
  string
> = {
  default: colors.surface,
  primary: colors.primarySoft,
  danger: colors.dangerSoft,
  warning: colors.warningSoft,
  success: colors.successSoft,
  muted: colors.mutedSurface,
};

export function SurfaceCard({
  children,
  variant = "card",
  tone = "default",
  style,
}: SurfaceCardProps) {
  const backgroundColor =
    variant === "inline" && tone === "default"
      ? "transparent"
      : toneBackground[tone];

  return (
    <View
      style={[
        styles.base,
        variant === "hero" && styles.hero,
        variant === "card" && styles.card,
        variant === "inline" && styles.inline,
        { backgroundColor },
        variant === "hero" && {
          borderColor:
            tone === "danger"
              ? colors.dangerSoft
              : tone === "warning"
                ? colors.warningSoft
                : tone === "primary"
                  ? colors.primarySoft
                  : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing.md,
  },
  hero: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  inline: {
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
  },
});
