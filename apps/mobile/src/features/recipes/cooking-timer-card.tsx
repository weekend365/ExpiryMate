import { Clock3, Pause, Play, RotateCcw, X } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { colors, radius, spacing } from "../../shared/theme";
import {
  formatCookingTimerClock,
  formatCookingTimerDuration,
  getCookingTimerProgress,
  isCookingTimerForStep,
  type StartCookingTimerInput,
} from "./cooking-timer";
import type { useCookingTimer } from "./use-cooking-timer";

type CookingTimerController = ReturnType<typeof useCookingTimer>;

export function CookingTimerCard({
  input,
  controller,
  onStart,
}: {
  input: StartCookingTimerInput;
  controller: CookingTimerController;
  onStart: () => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  const { timer, remainingSeconds, isHydrated, isPending, errorMessage } =
    controller;
  const isCurrent = isCookingTimerForStep(
    timer,
    input.recommendationId,
    input.dishIndex,
    input.stepIndex,
  );
  const status = isCurrent ? timer?.status : null;
  const clockSeconds = isCurrent
    ? remainingSeconds
    : input.durationSeconds;
  const durationSeconds = Math.max(1, Math.round(input.durationSeconds));
  const progress = getCookingTimerProgress(durationSeconds, clockSeconds);
  const elapsedSeconds = Math.round(durationSeconds * progress);
  const animatedProgress = useSharedValue(progress);
  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 250,
      reduceMotion: ReduceMotion.System,
    });
  }, [animatedProgress, progress]);

  const title =
    status === "completed"
      ? "시간이 다 됐어요"
      : status === "paused"
        ? "타이머를 잠시 멈췄어요"
        : status === "running"
          ? "조리 타이머가 가고 있어요"
          : `${formatCookingTimerDuration(input.durationSeconds)} 타이머`;

  return (
    <View
      testID="cooking-timer-card"
      style={[styles.card, status === "completed" && styles.completedCard]}
    >
      <View style={[styles.header, shouldStack && styles.headerStacked]}>
        <View style={styles.iconCircle}>
          <Clock3 color={colors.primary} size={spacing.md} strokeWidth={2.4} />
        </View>
        <View style={[styles.copy, shouldStack && styles.copyStacked]}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="bodySmall" tone="subtext">
            {status === "running"
              ? "다른 화면으로 이동해도 계속 알려드려요."
              : status === "paused"
                ? "재개하면 남은 시간의 알림을 다시 예약해요."
                : status === "completed"
                  ? "상태를 확인한 뒤 필요하면 다시 시작하세요."
                  : "눌러서 바로 시작할 수 있어요."}
          </AppText>
        </View>
        <AppText
          variant="heading"
          tone={status === "completed" ? "primary" : "default"}
          style={[styles.clock, shouldStack && styles.clockStacked]}
          accessibilityLabel={
            status === "completed"
              ? `${input.stepIndex + 1}단계 타이머 완료`
              : `남은 시간 ${formatCookingTimerDuration(clockSeconds)}`
          }
          accessibilityLiveRegion={
            status === "completed" ? "assertive" : undefined
          }
        >
          {formatCookingTimerClock(clockSeconds)}
        </AppText>
      </View>

      <View
        testID="cooking-timer-progress"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="조리 타이머 진행률"
        accessibilityValue={{
          min: 0,
          max: durationSeconds,
          now: elapsedSeconds,
          text:
            status === "completed"
              ? "완료"
              : `${formatCookingTimerDuration(clockSeconds)} 남음`,
        }}
        style={[
          styles.progressTrack,
          shouldStack && styles.progressTrackStacked,
        ]}
      >
        <Animated.View
          style={[styles.progressFill, animatedProgressStyle]}
        />
      </View>

      {isCurrent && status === "running" && !timer?.notificationsAllowed ? (
        <View style={styles.warning}>
          <AppText variant="bodySmall" tone="subtext">
            알림 권한이 꺼져 있어요. 앱 안에서는 시간이 계속 표시되지만,
            백그라운드 완료 알림은 받을 수 없어요.
          </AppText>
        </View>
      ) : null}

      <View style={[styles.actions, shouldStack && styles.actionsStacked]}>
        {status === "running" ? (
          <Button
            testID="cooking-timer-pause-button"
            variant="surface"
            size="small"
            icon={Pause}
            disabled={isPending || !isHydrated}
            onPress={() => void controller.pause()}
            style={[styles.action, shouldStack && styles.actionStacked]}
          >
            일시정지
          </Button>
        ) : status === "paused" ? (
          <Button
            testID="cooking-timer-resume-button"
            variant="surface"
            size="small"
            icon={Play}
            disabled={isPending || !isHydrated}
            onPress={() => void controller.resume()}
            style={[styles.action, shouldStack && styles.actionStacked]}
          >
            다시 시작
          </Button>
        ) : (
          <Button
            testID="cooking-timer-start-button"
            variant="surface"
            size="small"
            icon={status === "completed" ? RotateCcw : Play}
            disabled={isPending || !isHydrated}
            onPress={onStart}
            style={[styles.action, shouldStack && styles.actionStacked]}
          >
            {status === "completed" ? "다시 시작" : "타이머 시작"}
          </Button>
        )}
        {isCurrent ? (
          <Button
            testID="cooking-timer-cancel-button"
            variant={status === "completed" ? "surface" : "danger"}
            size="small"
            icon={X}
            disabled={isPending || !isHydrated}
            onPress={() => void controller.cancel()}
            style={[styles.action, shouldStack && styles.actionStacked]}
          >
            {status === "completed" ? "닫기" : "취소"}
          </Button>
        ) : null}
      </View>
      {errorMessage ? (
        <AppText variant="bodySmall" tone="danger">
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  completedCard: {
    borderColor: colors.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  iconCircle: {
    width: spacing.xl,
    height: spacing.xl,
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
  copyStacked: {
    flex: 0,
    width: "100%",
  },
  clock: {
    flexShrink: 0,
  },
  clockStacked: {
    alignSelf: "flex-end",
  },
  progressTrack: {
    width: "100%",
    minWidth: 0,
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
    backgroundColor: colors.primary,
  },
  warning: {
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  actionsStacked: {
    flexDirection: "column",
  },
  action: {
    flexGrow: 1,
  },
  actionStacked: {
    width: "100%",
    flexGrow: 0,
  },
});
