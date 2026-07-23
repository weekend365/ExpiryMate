import type { PropsWithChildren, ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { MascotSpeechBubble } from "./MascotSpeechBubble";
import type { MascotMood } from "./Mascot";

export interface StepFlowStep {
  key: string;
  label: string;
  title: string;
  description?: string;
}

interface StepFlowProps extends PropsWithChildren {
  steps: StepFlowStep[];
  currentIndex: number;
  onBack: () => void;
  /**
   * Prefer `Screen` `footer` for the primary CTA so it stays sticky above the
   * keyboard/safe area. Keep this only for rare in-flow secondary actions.
   */
  footer?: ReactNode;
  headerAccessory?: ReactNode;
  /** When set, replaces the step description with a speaking-mascot bubble. */
  guideMessage?: string;
  guideMood?: Extract<MascotMood, "speak" | "think" | "point" | "idle">;
}

const SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.85,
};

export function StepFlow({
  steps,
  currentIndex,
  onBack,
  footer,
  headerAccessory,
  guideMessage,
  guideMood = "speak",
  children,
}: StepFlowProps) {
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(steps.length - 1, 0));
  const activeStep = steps[safeIndex];
  const contentOpacity = useSharedValue(1);
  const contentOffset = useSharedValue(0);
  const resolvedGuide = guideMessage?.trim() || undefined;

  useEffect(() => {
    contentOpacity.value = 0;
    contentOffset.value = spacing.sm;
    contentOpacity.value = withSpring(1, SPRING);
    contentOffset.value = withSpring(0, SPRING);
  }, [contentOffset, contentOpacity, safeIndex]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentOffset.value }],
  }));

  if (!activeStep) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.progressCard}>
        <View style={styles.progressMeta}>
          <Pressable
            onPress={onBack}
            hitSlop={spacing.xs}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="이전으로 돌아가기"
          >
            <ChevronLeft color={colors.text} size={spacing.sm + spacing.xxs} strokeWidth={2.4} />
            <Text style={styles.backLabel}>뒤로</Text>
          </Pressable>
          <Text style={styles.progressLabel}>
            {safeIndex + 1}/{steps.length}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          {steps.map((step, index) => {
            const isActive = index === safeIndex;
            const isCompleted = index < safeIndex;

            return (
              <View
                key={step.key}
                style={[
                  styles.progressSegment,
                  (isActive || isCompleted) && styles.progressSegmentActive,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.stepHeader}>
          <View style={styles.stepCopy}>
            <Text style={styles.stepEyebrow}>{activeStep.label}</Text>
            <Text style={styles.stepTitle}>{activeStep.title}</Text>
            {!resolvedGuide && activeStep.description ? (
              <Text style={styles.stepDescription}>{activeStep.description}</Text>
            ) : null}
          </View>
          {headerAccessory ? (
            <View style={styles.headerAccessory}>{headerAccessory}</View>
          ) : null}
        </View>

        {resolvedGuide ? (
          <MascotSpeechBubble
            message={resolvedGuide}
            mood={guideMood}
            size="small"
          />
        ) : null}
      </View>

      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  progressMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  backButton: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.icon,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
  },
  backButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  backLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  progressLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  progressTrack: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  stepCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  stepEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  stepTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  stepDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  headerAccessory: {
    paddingTop: spacing.xxs,
  },
  content: {
    gap: spacing.lg,
  },
  footer: {
    gap: spacing.md,
  },
});
