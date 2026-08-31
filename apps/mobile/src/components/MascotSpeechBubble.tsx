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
} from "react-native-reanimated";
import { appBrand } from "@expirymate/shared";
import { colors, radius, spacing, touchTarget } from "../shared/theme";
import { AppText, type AppTextVariant } from "./AppText";
import { Mascot, type MascotMood } from "./Mascot";

interface MascotSpeechBubbleProps {
  message: string;
  mood?: MascotMood;
  size?: "small" | "medium";
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
 * Bubble chrome stays in React Native — never baked into character PNGs.
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
  onDismiss,
  inlineActionLabel,
  onInlineAction,
}: MascotSpeechBubbleProps) {
  const opacity = useSharedValue(0);
  const offset = useSharedValue(0);
  const isCompact = density === "compact";

  useEffect(() => {
    opacity.value = 0;
    offset.value = spacing.xs;
    opacity.value = withSpring(1, SPRING);
    offset.value = withSpring(0, SPRING);
  }, [message, mood, offset, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.root,
        isCompact && styles.rootCompact,
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
      <Mascot size={size} mood={mood} style={styles.mascot} />
      <View style={styles.bubbleColumn}>
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
        {/* Tail points toward the mascot (left). */}
        <View style={[styles.tail, isCompact && styles.tailCompact]} />
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
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingRight: touchTarget.icon + spacing.xs,
  },
  dismissButton: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: touchTarget.icon,
    height: touchTarget.icon,
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
    borderColor: colors.border,
    transform: [{ rotate: "45deg" }],
  },
  tailCompact: {
    bottom: spacing.xs,
  },
});
