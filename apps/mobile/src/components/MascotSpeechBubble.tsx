import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { appBrand } from "@expirymate/shared";
import { colors, radius, spacing } from "../shared/theme";
import { AppText } from "./AppText";
import { Mascot, type MascotMood } from "./Mascot";

interface MascotSpeechBubbleProps {
  message: string;
  mood?: MascotMood;
  size?: "small" | "medium";
  style?: StyleProp<ViewStyle>;
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
  style,
}: MascotSpeechBubbleProps) {
  const opacity = useSharedValue(0);
  const offset = useSharedValue(0);

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
      style={[styles.root, animatedStyle, style]}
      accessibilityRole="summary"
      accessibilityLabel={`${appBrand.characterNameKo}가 말해요. ${message}`}
    >
      <Mascot size={size} mood={mood} style={styles.mascot} />
      <View style={styles.bubbleColumn}>
        <View style={styles.bubble}>
          <AppText variant="bodySmall">{message}</AppText>
        </View>
        {/* Tail points toward the mascot (left). */}
        <View style={styles.tail} />
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
});