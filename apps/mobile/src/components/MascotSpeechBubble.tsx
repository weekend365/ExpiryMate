import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { X } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useReducedMotion,
  cancelAnimation,
} from "react-native-reanimated";
import { appBrand } from "@expirymate/shared";
import { colors, radius, spacing, controlSize } from "../shared/theme";
import { AppText, type AppTextVariant } from "./AppText";
import { LARGE_TEXT_MIN_FONT_SCALE, useResponsiveLayout } from "../shared/responsive-layout";
import { Mascot, type MascotMood } from "./Mascot";

interface MascotSpeechBubbleProps {
  message: string;
  mood?: MascotMood;
  size?: "small" | "medium" | "large";
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  /** Headline lines (step questions, success) should read as the main copy. */
  textVariant?: AppTextVariant;
  /** Quieter follow-up under the main line. */
  supportingMessage?: string;
  /**
   * `compact` tightens bubble padding and copy for status heroes
   * that sit above a list, not as the page title.
   */
  density?: "default" | "compact";
  /** Adaptive guides keep the full body and copy visible on small/large-text screens. */
  layout?: "inline" | "stacked" | "adaptive";
  /** Input and cooking guides stay still while the user works. */
  animation?: "entrance" | "none";
  /** Adds a close affordance for transient, event-driven notices only. */
  onDismiss?: () => void;
  /** Optional link appended to the message in the same text line. */
  inlineActionLabel?: string;
  onInlineAction?: () => void;
}

const SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.85,
};

/**
 * Pairs a Mascot mood with a UI speech bubble.
 * Bubble chrome stays separate from character PNGs and behind live copy.
 */
export function MascotSpeechBubble({
  message,
  mood = "speak",
  size = "small",
  numberOfLines,
  style,
  textVariant = "bodySmall",
  supportingMessage,
  density = "default",
  layout = "inline",
  animation = "entrance",
  onDismiss,
  inlineActionLabel,
  onInlineAction,
}: MascotSpeechBubbleProps) {
  const opacity = useSharedValue(0);
  const offset = useSharedValue(0);
  const isCompact = density === "compact";
  const { shouldStackDense, fontScale } = useResponsiveLayout();
  // Native 1.3 can arrive as 1.2999999523162842. Only normalize this opt-in layout.
  const isLargeText = Math.round(fontScale * 1_000_000) / 1_000_000 >= LARGE_TEXT_MIN_FONT_SCALE;
  const isStacked = layout === "stacked" ||
    (layout === "adaptive" && (size === "large" ||
      (size === "medium" ? shouldStackDense : isLargeText)));
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || animation === "none") {
      opacity.value = 1;
      offset.value = 0;
      return;
    }
    opacity.value = 0;
    offset.value = spacing.xs;
    opacity.value = withSpring(1, SPRING);
    offset.value = withSpring(0, SPRING);
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(offset);
    };
  }, [message, mood, offset, opacity, reduceMotion, animation]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.root,
        isCompact && styles.rootCompact,
        isStacked && styles.rootStacked,
        animatedStyle,
        style,
      ]}
      accessible={!onDismiss && !onInlineAction}
      accessibilityRole={onDismiss || onInlineAction ? undefined : "summary"}
      accessibilityLabel={
        onDismiss || onInlineAction
          ? undefined
          : `${appBrand.characterNameKo}가 말해요. ${message}${
              supportingMessage?.trim()
                ? ` ${supportingMessage.trim()}`
                : ""
            }`
      }
    >
      <Mascot size={size} mood={mood} decorative style={styles.mascot} />
      <View style={[styles.bubbleColumn, isStacked && styles.bubbleColumnStacked]}>
        <View
          style={[
            styles.bubble,
            isCompact && styles.bubbleCompact,
            onDismiss && styles.bubbleDismissible,
          ]}
        >
          <AppText
            variant={textVariant}
            numberOfLines={numberOfLines}
          >
            {message}
            {inlineActionLabel && onInlineAction ? (
              <AppText
                variant={textVariant}
                tone="link"
                onPress={onInlineAction}
                accessibilityRole="link"
                accessibilityLabel={inlineActionLabel}
              >
                {` ${inlineActionLabel}`}
              </AppText>
            ) : null}
          </AppText>
          {supportingMessage?.trim() ? (
            <AppText
              variant="bodySmall"
              tone="subtext"
            >
              {supportingMessage.trim()}
            </AppText>
          ) : null}
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              testID="mascot-speech-dismiss-button"
              accessibilityRole="button"
              accessibilityLabel="장고 알림 닫기"
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.dismissButton,
                pressed && styles.dismissButtonPressed,
              ]}
            >
              <X color={colors.subtext} size={spacing.sm} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
        {/* Tail points left by default, or up toward the stacked mascot. */}
        <View
          style={[
            styles.tail,
            isCompact && styles.tailCompact,
            isStacked && styles.tailStacked,
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  rootCompact: {
    alignItems: "center",
    gap: spacing.xs,
  },
  rootStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  mascot: {
    flexShrink: 0,
  },
  bubbleColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
    position: "relative",
    paddingLeft: spacing.xs,
  },
  bubbleColumnStacked: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    paddingLeft: spacing.none,
    paddingTop: spacing.xs,
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: spacing.xxl,
    justifyContent: "center",
    gap: spacing.xs,
  },
  bubbleCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.xxs, // 4px: keep the question and guide as one thought
  },
  bubbleDismissible: {
    paddingRight: controlSize.icon + spacing.xs,
  },
  dismissButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: controlSize.icon,
    height: controlSize.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  dismissButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  tail: {
    position: "absolute",
    left: 0,
    bottom: spacing.sm,
    width: spacing.sm,
    height: spacing.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
    transform: [{ rotate: "45deg" }],
  },
  tailCompact: {
    bottom: spacing.xs,
  },
  tailStacked: {
    top: spacing.none,
    bottom: "auto",
    left: spacing.md,
    transform: [{ rotate: "135deg" }],
  },
});
