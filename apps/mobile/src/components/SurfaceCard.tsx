import type { PropsWithChildren } from "react";
import type { SurfaceTone } from "@expirymate/shared";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { CrayonCardDecoration } from "./CrayonCardDecoration";

export type SurfaceVariant = "hero" | "card" | "inline";

interface SurfaceCardProps extends PropsWithChildren {
  /** hero = one focus surface per screen; card = bordered section; inline = open/no chrome */
  variant?: SurfaceVariant;
  tone?: SurfaceTone;
  /** Opt-in only; the reviewed crayon treatment applies to hero cards. */
  decoration?: "crayon";
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
  decoration,
  style,
}: SurfaceCardProps) {
  const hasCrayonDecoration = variant === "hero" && decoration === "crayon";
  const backgroundColor =
    variant === "inline" && tone === "default"
      ? "transparent"
      : variant === "hero" && tone === "default"
        ? colors.surfaceWarm
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
                  : colors.borderSubtle,
        },
        style,
        hasCrayonDecoration && styles.decorated,
      ]}
    >
      {hasCrayonDecoration && <CrayonCardDecoration tone={tone} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing.md,
  },
  decorated: {
    borderColor: "transparent",
  },
  hero: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
  },
  inline: {
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
  },
});
