import type { PropsWithChildren, ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";
import { colors, radius, spacing, touchTarget } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";
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
  guideMood?: MascotMood;
  /**
   * `compact` drops the chrome card and eyebrow so 장고's bubble carries
   * the step question. Use when the stack header already owns Back.
   */
  density?: "default" | "compact";
  /** Hide the in-flow back control when the screen header already provides one. */
  hideBack?: boolean;
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
  density = "default",
  hideBack = false,
  children,
}: StepFlowProps) {
  const { shouldStack } = useResponsiveLayout();
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(steps.length - 1, 0));
  const activeStep = steps[safeIndex];
  const contentOpacity = useSharedValue(1);
  const contentOffset = useSharedValue(0);
  const resolvedGuide = guideMessage?.trim() || undefined;
  const isCompact = density === "compact";
  const showProgress = steps.length > 1;
  const showBack = !hideBack;

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

  const progressTrack = showProgress ? (
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
  ) : null;

  const compactMessage = activeStep.title;

  const stepCopy = isCompact ? (
    <View style={[styles.stepHeader, shouldStack && styles.stepHeaderStacked]}>
      <View style={styles.guideCard}>
        <MascotSpeechBubble
          message={compactMessage}
          supportingMessage={resolvedGuide}
          mood={guideMood}
          size="small"
          density="compact"
          textVariant="bodyStrong"
          style={styles.compactBubble}
        />
      </View>
      {headerAccessory ? (
        <View
          style={[
            styles.headerAccessory,
            shouldStack && styles.headerAccessoryStacked,
          ]}
        >
          {headerAccessory}
        </View>
      ) : null}
    </View>
  ) : (
    <View style={[styles.stepHeader, shouldStack && styles.stepHeaderStacked]}>
      <View style={styles.stepCopy}>
        <AppText variant="label" tone="primary">
          {activeStep.label}
        </AppText>
        <AppText variant="heading">{activeStep.title}</AppText>
        {!resolvedGuide && activeStep.description ? (
          <AppText variant="bodySmall" tone="subtext">
            {activeStep.description}
          </AppText>
        ) : null}
      </View>
      {headerAccessory ? (
        <View
          style={[
            styles.headerAccessory,
            shouldStack && styles.headerAccessoryStacked,
          ]}
        >
          {headerAccessory}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, isCompact && styles.rootCompact]}>
      {isCompact ? (
        <View style={styles.plainHeader}>
          {showProgress ? (
            <View style={styles.progressStepper}>
              <View style={styles.progressMeta}>
                {showBack ? (
                  <Pressable
                    onPress={onBack}
                    hitSlop={spacing.xs}
                    style={({ pressed }) => [
                      styles.backButton,
                      pressed && styles.backButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="뒤로가기"
                  >
                    <ChevronLeft
                      color={colors.text}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <AppText variant="bodySmall" scaleRole="chrome">
                      뒤로가기
                    </AppText>
                  </Pressable>
                ) : (
                  <AppText variant="label" tone="subtext" scaleRole="chrome">
                    {activeStep.label}
                  </AppText>
                )}
                <AppText variant="label" tone="primary" scaleRole="chrome">
                  {safeIndex + 1}/{steps.length}
                </AppText>
              </View>
              {progressTrack}
            </View>
          ) : showBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="뒤로가기"
            >
              <ChevronLeft
                color={colors.text}
                size={spacing.sm + spacing.xxs}
                strokeWidth={2.4}
              />
              <AppText variant="bodySmall" scaleRole="chrome">
                뒤로가기
              </AppText>
            </Pressable>
          ) : null}
          {stepCopy}
        </View>
      ) : (
        <View style={styles.progressCard}>
          <View style={styles.progressMeta}>
            {showBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={spacing.xs}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="뒤로가기"
              >
                <ChevronLeft
                  color={colors.text}
                  size={spacing.sm + spacing.xxs}
                  strokeWidth={2.4}
                />
                <AppText variant="bodySmall" scaleRole="chrome">
                  뒤로가기
                </AppText>
              </Pressable>
            ) : (
              <View />
            )}
            <AppText variant="label" tone="primary" scaleRole="chrome">
              {safeIndex + 1}/{steps.length}
            </AppText>
          </View>
          {progressTrack}
          {stepCopy}
          {resolvedGuide ? (
            <MascotSpeechBubble
              message={resolvedGuide}
              mood={guideMood}
              size="small"
            />
          ) : null}
        </View>
      )}

      <Animated.View
        style={[styles.content, isCompact && styles.contentCompact, contentStyle]}
      >
        {children}
      </Animated.View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xxl,
  },
  rootCompact: {
    gap: spacing.sm,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  progressStepper: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  plainHeader: {
    gap: spacing.sm,
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
  stepHeaderStacked: {
    flexDirection: "column",
    gap: spacing.sm,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  compactBubble: {
    flex: 1,
    minWidth: 0,
  },
  guideCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  headerAccessory: {
    flexShrink: 1,
    paddingTop: spacing.xxs,
  },
  headerAccessoryStacked: {
    width: "100%",
    paddingTop: spacing.none,
  },
  content: {
    gap: spacing.lg,
  },
  contentCompact: {
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.md,
  },
});
