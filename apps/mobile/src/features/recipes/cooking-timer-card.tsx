import { Clock3, Pause, Play, RotateCcw, X } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { colors, radius, spacing } from "../../shared/theme";
import {
  formatCookingTimerClock,
  formatCookingTimerDuration,
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
  const title =
    status === "completed"
      ? "시간이 다 됐어요"
      : status === "paused"
        ? "타이머를 잠시 멈췄어요"
        : status === "running"
          ? "조리 타이머가 가고 있어요"
          : `${formatCookingTimerDuration(input.durationSeconds)} 타이머`;

  return (
    <View style={[styles.card, status === "completed" && styles.completedCard]}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Clock3 color={colors.primary} size={spacing.md} strokeWidth={2.4} />
        </View>
        <View style={styles.copy}>
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
          accessibilityLabel={`남은 시간 ${formatCookingTimerDuration(clockSeconds)}`}
        >
          {formatCookingTimerClock(clockSeconds)}
        </AppText>
      </View>

      {isCurrent && status === "running" && !timer?.notificationsAllowed ? (
        <View style={styles.warning}>
          <AppText variant="bodySmall" tone="subtext">
            알림 권한이 꺼져 있어요. 앱 안에서는 시간이 계속 표시되지만,
            백그라운드 완료 알림은 받을 수 없어요.
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {status === "running" ? (
          <Button
            variant="surface"
            size="small"
            icon={Pause}
            disabled={isPending || !isHydrated}
            onPress={() => void controller.pause()}
            style={styles.action}
          >
            일시정지
          </Button>
        ) : status === "paused" ? (
          <Button
            variant="surface"
            size="small"
            icon={Play}
            disabled={isPending || !isHydrated}
            onPress={() => void controller.resume()}
            style={styles.action}
          >
            다시 시작
          </Button>
        ) : (
          <Button
            variant="surface"
            size="small"
            icon={status === "completed" ? RotateCcw : Play}
            disabled={isPending || !isHydrated}
            onPress={onStart}
            style={styles.action}
          >
            {status === "completed" ? "다시 시작" : "타이머 시작"}
          </Button>
        )}
        {isCurrent && status !== "completed" ? (
          <Button
            variant="danger"
            size="small"
            icon={X}
            disabled={isPending || !isHydrated}
            onPress={() => void controller.cancel()}
            style={styles.action}
          >
            취소
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
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
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
    minWidth: 160,
    gap: spacing.xxs,
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
  action: {
    flexGrow: 1,
  },
});
