import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { colors, radius, spacing, controlSize } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText, type AppTextVariant } from "./AppText";
import type { MascotMood } from "./Mascot";
import { MascotSpeechBubble } from "./MascotSpeechBubble";

type FeedbackTone = "danger" | "success" | "warning" | "info";

interface FeedbackBannerProps {
  testID?: string;
  tone?: FeedbackTone;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Keeps the default link below the bubble, or highlights it inside. */
  speechActionPlacement?: "below" | "inside";
  /** `inline` is the default; reserve `mascot` for a screen-level hero notice. */
  presentation?: "inline" | "mascot";
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
  testID,
  tone = "danger",
  title,
  description,
  actionLabel,
  onAction,
  speechActionPlacement = "below",
  presentation = "inline",
  transient = false,
  speechDensity = "compact",
  speechTextVariant = "bodyStrong",
  autoDismissMs = DEFAULT_FEEDBACK_AUTO_DISMISS_MS,
  onDismiss,
}: FeedbackBannerProps) {
  const palette = toneConfig[tone];
  const showMascot = presentation === "mascot";
  const [isVisible, setIsVisible] = useState(true);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState<
    boolean | null
  >(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const { isComfortableText } = useResponsiveLayout();
  const isTransientNotice = transient;
  const hasAction = Boolean(actionLabel && onAction);
  const shouldAutoDismiss = Boolean(
    isTransientNotice &&
      autoDismissMs !== null &&
      !hasAction &&
      tone !== "danger" &&
      !isComfortableText &&
      screenReaderEnabled === false,
  );
  const noticeKey = `${tone}\u0000${title}\u0000${description ?? ""}`;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (active) setScreenReaderEnabled(enabled);
      })
      .catch(() => {
        if (active) setScreenReaderEnabled(false);
      });
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderEnabled,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setIsVisible(true);

    if (!shouldAutoDismiss || autoDismissMs === null) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsVisible(false);
      onDismissRef.current?.();
    }, autoDismissMs);

    return () => clearTimeout(timeout);
  }, [autoDismissMs, noticeKey, shouldAutoDismiss]);

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
        onDismiss={isTransientNotice ? dismiss : undefined}
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
    <>
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
      {isTransientNotice ? (
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="알림 닫기"
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.actionPressed,
          ]}
        >
          <X color={colors.disclosureText} size={spacing.sm} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </>
  );

  const rootStyle = [
    styles.root,
    showMascot ? styles.speechRoot : styles.inlineRoot,
    !showMascot && { backgroundColor: palette.backgroundColor },
  ];

  return (
    <View
      testID={testID}
      style={rootStyle}
      accessibilityLiveRegion="polite"
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: controlSize.minimum,
  },
  speechRoot: {
    alignItems: "stretch",
  },
  inlineRoot: {
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  speechContent: {
    gap: spacing.xs,
  },
  speechAction: {
    alignSelf: "flex-end",
    minHeight: controlSize.minimum,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  actionPressed: {
    opacity: 0.85,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  action: {
    alignSelf: "flex-start",
    minHeight: controlSize.minimum,
    justifyContent: "center",
    paddingRight: spacing.sm,
  },
  dismissButton: {
    width: controlSize.icon,
    height: controlSize.icon,
    marginTop: -spacing.xs,
    marginRight: -spacing.xs,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
