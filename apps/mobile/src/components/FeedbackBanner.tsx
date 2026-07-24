import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "../shared/theme";
import { AppText } from "./AppText";
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
    titleTone: "danger" | "default";
    mascotMood: MascotMood;
  }
> = {
  danger: {
    backgroundColor: colors.dangerSoft,
    titleTone: "danger",
    mascotMood: "worry",
  },
  success: {
    backgroundColor: colors.successSoft,
    titleTone: "default",
    mascotMood: "happy",
  },
  warning: {
    backgroundColor: colors.warningSoft,
    titleTone: "default",
    mascotMood: "worry",
  },
  info: {
    backgroundColor: colors.primarySoft,
    titleTone: "default",
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
  const isActionable = Boolean(actionLabel && onAction);

  const content = (
    <>
      {showMascot ? <Mascot size="small" mood={palette.mascotMood} /> : null}
      <View style={styles.copy}>
        <AppText variant="bodyStrong" tone={palette.titleTone}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySmall">{description}</AppText>
        ) : null}
        {actionLabel && onAction ? (
          <View style={styles.action}>
            <AppText variant="bodyStrong" tone="primary">
              {actionLabel}
            </AppText>
          </View>
        ) : null}
      </View>
    </>
  );

  if (isActionable && onAction) {
    return (
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityLiveRegion="polite"
        style={({ pressed }) => [
          styles.root,
          { backgroundColor: palette.backgroundColor },
          pressed && styles.rootPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.root, { backgroundColor: palette.backgroundColor }]}
      accessibilityLiveRegion="polite"
    >
      {content}
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
  rootPressed: {
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  action: {
    alignSelf: "flex-start",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingRight: spacing.sm,
  },
});
