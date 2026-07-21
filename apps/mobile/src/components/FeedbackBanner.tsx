import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { Mascot, type MascotMood } from "./Mascot";

type FeedbackTone = "danger" | "success" | "warning" | "info";

interface FeedbackBannerProps {
  tone?: FeedbackTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** When false, mascot is hidden (compact inline strip). Default true. */
  showMascot?: boolean;
}

const toneConfig: Record<
  FeedbackTone,
  {
    backgroundColor: string;
    titleColor: string;
    mascotMood: MascotMood;
  }
> = {
  danger: {
    backgroundColor: colors.dangerSoft,
    titleColor: colors.danger,
    mascotMood: "worry",
  },
  success: {
    backgroundColor: colors.successSoft,
    titleColor: colors.text,
    mascotMood: "happy",
  },
  warning: {
    backgroundColor: colors.warningSoft,
    titleColor: colors.text,
    mascotMood: "worry",
  },
  info: {
    backgroundColor: colors.primarySoft,
    titleColor: colors.text,
    mascotMood: "idle",
  },
};

export function FeedbackBanner({
  tone = "danger",
  title,
  description,
  actionLabel,
  onAction,
  showMascot = true,
}: FeedbackBannerProps) {
  const palette = toneConfig[tone];

  return (
    <View
      style={[styles.root, { backgroundColor: palette.backgroundColor }]}
      accessibilityLiveRegion="polite"
    >
      {showMascot ? <Mascot size="small" mood={palette.mascotMood} /> : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.titleColor }]}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={spacing.xs}
            style={({ pressed }) => [
              styles.action,
              pressed && styles.actionPressed,
            ]}
          >
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget.min,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  description: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  action: {
    alignSelf: "flex-start",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingRight: spacing.sm,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
});
