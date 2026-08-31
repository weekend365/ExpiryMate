import { ChevronRight, Clock3 } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { colors, radius, spacing, controlSize } from "../../shared/theme";
import {
  formatCookingTimerClock,
  formatCookingTimerDuration,
  getCookingTimerProgress,
  getCookingTimerAccessibilityLabel,
} from "./cooking-timer";
import type { useCookingTimer } from "./use-cooking-timer";

type CookingTimerController = ReturnType<typeof useCookingTimer>;

export function ActiveCookingTimerBar({
  controller,
  onOpenStep,
}: {
  controller: CookingTimerController;
  onOpenStep: (stepIndex: number) => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  const { timer, remainingSeconds } = controller;
  if (!timer) {
    return null;
  }

  const progress = getCookingTimerProgress(
    timer.durationSeconds,
    remainingSeconds,
  );
  const elapsedSeconds = Math.round(timer.durationSeconds * progress);

  return (
    <View testID="active-cooking-timer-bar" style={styles.card}>
      <Pressable
        onPress={() => onOpenStep(timer.stepIndex)}
        accessibilityRole="button"
        accessibilityLabel={getCookingTimerAccessibilityLabel(
          timer.stepIndex,
          timer.status,
          remainingSeconds,
        )}
        accessibilityHint="타이머가 시작된 조리 단계로 이동해요"
        style={({ pressed }) => [
          styles.header,
          shouldStack && styles.headerStacked,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.iconCircle}>
          <Clock3 color={colors.primaryForeground} size={spacing.sm} strokeWidth={2.4} />
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyStrong" tone="primary">
            {timer.stepIndex + 1}단계 타이머가
            {timer.status === "running"
              ? " 계속 진행 중이에요"
              : timer.status === "paused"
                ? " 잠시 멈췄어요"
                : " 끝났어요"}
          </AppText>
          <AppText variant="bodySmall" tone="subtext">
            {timer.status === "completed"
              ? "눌러서 완료된 단계를 확인해 주세요."
              : "눌러서 해당 단계로 돌아갈 수 있어요."}
          </AppText>
        </View>
        <View style={styles.clockRow}>
          <AppText variant="heading">
            {formatCookingTimerClock(remainingSeconds)}
          </AppText>
          <ChevronRight
            color={colors.subtext}
            size={spacing.md}
            strokeWidth={2.2}
          />
        </View>
      </Pressable>

      <View
        testID="active-cooking-timer-progress"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={
          timer.status === "completed"
            ? "다른 단계에서 완료된 조리 타이머"
            : "다른 단계에서 실행 중인 조리 타이머"
        }
        accessibilityValue={{
          min: 0,
          max: timer.durationSeconds,
          now: elapsedSeconds,
          text:
            timer.status === "completed"
              ? "완료"
              : `${formatCookingTimerDuration(remainingSeconds)} 남음`,
        }}
        style={[styles.progressTrack, shouldStack && styles.progressTrackStacked]}
      >
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  header: {
    minHeight: controlSize.minimum,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerStacked: {
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  iconCircle: {
    width: controlSize.icon,
    height: controlSize.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: spacing.xxs,
  },
  progressTrack: {
    width: "100%",
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressTrackStacked: {
    height: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.brandAccent,
  },
  pressed: {
    opacity: 0.72,
  },
});
