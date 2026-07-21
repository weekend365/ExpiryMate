import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radius, spacing } from "../shared/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Mascot, type MascotMood } from "./Mascot";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Prefer `mood` for 장고 empty/success states. Icon is a fallback only. */
  mood?: MascotMood;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  accessory?: ReactNode;
  /**
   * `plain` = no card chrome (nested under a hero/section).
   * `card` = bordered surface for standalone empty screens.
   */
  variant?: "plain" | "card";
  /** Hide mascot even when mood is set — use when another hero already shows 장고. */
  showMascot?: boolean;
}

export function EmptyState({
  title,
  description,
  mood,
  icon: Icon,
  actionLabel,
  onAction,
  accessory,
  variant = "card",
  showMascot = true,
}: EmptyStateProps) {
  const shouldShowMascot = Boolean(mood) && showMascot;

  return (
    <View style={[styles.root, variant === "card" ? styles.card : styles.plain]}>
      {shouldShowMascot ? (
        <View style={styles.mascotWrap}>
          <Mascot size={variant === "card" ? "medium" : "small"} mood={mood} />
        </View>
      ) : Icon ? (
        <View style={styles.iconWrap}>
          <Icon color={colors.primary} size={spacing.md} strokeWidth={2.4} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <AppText variant="subheading" style={styles.centered}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySmall" tone="subtext" style={styles.centered}>
            {description}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button onPress={onAction} fullWidth>
          {actionLabel}
        </Button>
      ) : null}
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    alignItems: "stretch",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  plain: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  mascotWrap: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  copy: {
    gap: spacing.xs,
    alignItems: "center",
  },
  centered: {
    textAlign: "center",
  },
});
