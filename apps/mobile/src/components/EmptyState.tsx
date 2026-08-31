import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radius, spacing } from "../shared/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";
import type { MascotMood } from "./Mascot";
import { MascotSpeechBubble } from "./MascotSpeechBubble";

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
  /** Determines the default presentation and communicates state intent. */
  kind: "empty" | "no-results" | "error" | "success" | "loading";
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
  kind,
}: EmptyStateProps) {
  const mascotByDefault = kind === "empty" || kind === "success";
  const shouldShowMascot = Boolean(mood) && mascotByDefault;

  return (
    <View style={[styles.root, variant === "card" ? styles.card : styles.plain]}>
      {shouldShowMascot ? (
        <MascotSpeechBubble
          message={title}
          supportingMessage={description}
          size={variant === "card" ? "medium" : "small"}
          mood={mood}
          textVariant="bodyStrong"
          density={variant === "plain" ? "compact" : "default"}
        />
      ) : (
        <>
          {Icon ? (
            <View style={styles.iconWrap}>
              <Icon color={colors.primaryForeground} size={spacing.md} strokeWidth={2.4} />
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
        </>
      )}
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
