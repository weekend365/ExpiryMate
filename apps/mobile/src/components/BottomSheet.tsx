import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  TABLET_SHEET_MAX_WIDTH,
  useResponsiveLayout,
} from "../shared/responsive-layout";
import { colors, radius, spacing, touchTarget } from "../shared/theme";
import { AppText } from "./AppText";
import { Mascot, type MascotMood } from "./Mascot";

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Optional 장고 mood above the sheet title (success / confirm / guide). */
  mascotMood?: MascotMood;
  footer?: ReactNode;
  /** When false, body content is not wrapped in a ScrollView (e.g. native date picker). */
  scrollEnabled?: boolean;
}

const SPRING = {
  damping: 20,
  stiffness: 220,
  mass: 0.9,
};

const BACKDROP_OPACITY = 0.28;
const DRAG_DISMISS_DISTANCE = 96;
const DRAG_DISMISS_VELOCITY = 900;

export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  mascotMood,
  footer,
  scrollEnabled = true,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, isRegular } = useResponsiveLayout();
  const translateY = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      translateY.value = windowHeight;
      backdropOpacity.value = 0;
      return;
    }

    translateY.value = windowHeight;
    backdropOpacity.value = 0;
    translateY.value = withSpring(0, SPRING);
    backdropOpacity.value = withTiming(BACKDROP_OPACITY, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [backdropOpacity, translateY, visible, windowHeight]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(visible)
        .activeOffsetY([-spacing.xs, spacing.xs])
        .onStart(() => {
          dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          const nextTranslateY = Math.max(
            0,
            dragStartY.value + event.translationY,
          );
          const dragProgress = Math.min(
            1,
            nextTranslateY / Math.max(windowHeight, 1),
          );

          translateY.value = nextTranslateY;
          backdropOpacity.value = BACKDROP_OPACITY * (1 - dragProgress);
        })
        .onEnd((event) => {
          const shouldDismiss =
            event.translationY >= DRAG_DISMISS_DISTANCE ||
            event.velocityY >= DRAG_DISMISS_VELOCITY;

          if (shouldDismiss) {
            runOnJS(onClose)();
            return;
          }

          translateY.value = withSpring(0, SPRING);
          backdropOpacity.value = withTiming(BACKDROP_OPACITY, {
            duration: 180,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [
      backdropOpacity,
      dragStartY,
      onClose,
      translateY,
      visible,
      windowHeight,
    ],
  );

  // Unmount in the same render as dismiss. Keeping a transparent Modal around
  // for exit animation steals taps from stack headers (뒤로가기) app-wide on iOS.
  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="이 창을 닫을게요"
          />
        </Animated.View>

        <KeyboardAvoidingView
          // Modal sheets don't inherit Android window resize the same way as
          // the root activity — pad on both platforms so footers stay visible.
          behavior="padding"
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
          keyboardVerticalOffset={Platform.OS === "android" ? spacing.xs : 0}
        >
          <Animated.View
            style={[
              styles.sheet,
              isRegular && styles.regularSheet,
              sheetStyle,
              {
                maxHeight: windowHeight * 0.88,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <GestureDetector gesture={dragGesture}>
              <View
                style={styles.dragHeader}
                accessible
                accessibilityLabel={
                  [title, description].filter(Boolean).join(". ") || "바텀시트"
                }
                accessibilityHint="아래로 끌어 닫을 수 있어요"
              >
                <View style={styles.handle} />
                {mascotMood ? (
                  <View style={styles.mascotWrap}>
                    <Mascot size="small" mood={mascotMood} />
                  </View>
                ) : null}
                {title ? (
                  <View style={styles.header}>
                    <AppText variant="heading">{title}</AppText>
                    {description ? (
                      <AppText variant="bodySmall" tone="subtext">
                        {description}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            {scrollEnabled ? (
              <ScrollView
                style={styles.bodyScroll}
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.body, styles.bodyFixed]}>{children}</View>
            )}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.text,
  },
  sheet: {
    width: "100%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
    overflow: "hidden",
  },
  regularSheet: {
    maxWidth: TABLET_SHEET_MAX_WIDTH,
    alignSelf: "center",
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  dragHeader: {
    minHeight: touchTarget.min,
    gap: spacing.md,
    justifyContent: "center",
    flexShrink: 0,
  },
  handle: {
    alignSelf: "center",
    width: spacing.xl,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  mascotWrap: {
    alignItems: "center",
    flexShrink: 0,
  },
  header: {
    gap: spacing.xs,
    flexShrink: 0,
  },
  bodyScroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  bodyFixed: {
    flexShrink: 1,
    minHeight: 0,
  },
  body: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
    minHeight: touchTarget.min,
    flexShrink: 0,
  },
});
