import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "../shared/theme";
import { AppText, type AppTextVariant } from "./AppText";
import type { MascotMood } from "./Mascot";
import { MascotSpeechBubble } from "./MascotSpeechBubble";

type FeedbackTone = "danger" | "success" | "warning" | "info";

interface FeedbackBannerProps {
  tone?: FeedbackTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Keeps the default link below the bubble, or highlights it inside. */
  speechActionPlacement?: "below" | "inside";
  /** When false, mascot is hidden (compact inline strip). Default true. */
  showMascot?: boolean;
  /** Event feedback disappears automatically and can be closed immediately. */
  transient?: boolean;
  /** Lets hero placements use the same spacing as Home and Recommendations. */
  speechDensity?: "default" | "compact";
  speechTextVariant?: AppTextVariant;
  /** Set to `null` to keep a transient notice until the user closes it. */
  autoDismissMs?: number | null;
  onDismiss?: () => void;
}

export const DEFAULT_FEEDBACK_AUTO_DISMISS_MS = 5_000;

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
  speechActionPlacement = "below",
  showMascot = true,
  transient = false,
  speechDensity = "compact",
  speechTextVariant = "bodyStrong",
  autoDismissMs = DEFAULT_FEEDBACK_AUTO_DISMISS_MS,
  onDismiss,
}: FeedbackBannerProps) {
  const palette = toneConfig[tone];
  const [isVisible, setIsVisible] = useState(true);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const isTransientJangoNotice = transient && showMascot;
  const noticeKey = `${tone}\u0000${title}\u0000${description ?? ""}`;

  useEffect(() => {
    setIsVisible(true);

    if (!isTransientJangoNotice || autoDismissMs === null) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsVisible(false);
      onDismissRef.current?.();
    }, autoDismissMs);

    return () => clearTimeout(timeout);
  }, [autoDismissMs, isTransientJangoNotice, noticeKey]);

  if (!isVisible) {
    return null;
  }

  const dismiss = () => {
    setIsVisible(false);
    onDismissRef.current?.();
  };

  const copy = (
    <>
      <AppText variant="bodyStrong" tone={palette.titleTone}>
        {title}
      </AppText>
      {description ? <AppText variant="bodySmall">{description}</AppText> : null}
    </>
  );

  const content = showMascot ? (
    <View style={styles.speechContent}>
      <MascotSpeechBubble
        message={title}
        supportingMessage={description}
        mood={palette.mascotMood}
        density={speechDensity}
        textVariant={speechTextVariant}
        onDismiss={isTransientJangoNotice ? dismiss : undefined}
        inlineActionLabel={
          speechActionPlacement === "inside" ? actionLabel : undefined
        }
        onInlineAction={
          speechActionPlacement === "inside" ? onAction : undefined
        }
      />
      {speechActionPlacement === "below" && actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.speechAction,
            pressed && styles.actionPressed,
          ]}
        >
          <AppText variant="bodyStrong" tone="primary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  ) : (
    <View style={styles.copy}>
      {copy}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <AppText variant="bodyStrong" tone="primary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );

  const rootStyle = [
    styles.root,
    showMascot ? styles.speechRoot : styles.inlineRoot,
    !showMascot && { backgroundColor: palette.backgroundColor },
  ];

  return (
    <View style={rootStyle} accessibilityLiveRegion="polite">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: touchTarget.min,
  },
  speechRoot: {
    alignItems: "stretch",
  },
  inlineRoot: {
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  speechContent: {
    gap: spacing.xs,
  },
  speechAction: {
    alignSelf: "flex-end",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  actionPressed: {
    opacity: 0.85,
  },
  copy: {
    minWidth: 0,
    gap: spacing.xxs,
  },
  action: {
    alignSelf: "flex-start",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingRight: spacing.sm,
  },
});
