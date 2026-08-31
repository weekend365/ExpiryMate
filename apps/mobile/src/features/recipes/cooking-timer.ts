import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cancelScheduledNotification,
  scheduleCookingTimerNotification,
} from "../../services/notifications";

const COOKING_TIMER_STORAGE_KEY = "expirymate:cooking-timer:v1";

export type CookingTimerStatus = "running" | "paused" | "completed";

export type CookingTimer = {
  version: 2;
  ownerKey: string;
  spaceId: string;
  recommendationId: string;
  dishIndex: number;
  stepIndex: number;
  dishTitle: string;
  stepText: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: CookingTimerStatus;
  endsAt: number | null;
  notificationId: string | null;
  notificationsAllowed: boolean;
};

export type StartCookingTimerInput = Pick<
  CookingTimer,
  | "ownerKey"
  | "spaceId"
  | "recommendationId"
  | "dishIndex"
  | "stepIndex"
  | "dishTitle"
  | "stepText"
  | "durationSeconds"
>;

function isCookingTimer(value: unknown): value is CookingTimer {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<CookingTimer>;
  return (
    candidate.version === 2 &&
    typeof candidate.ownerKey === "string" &&
    typeof candidate.spaceId === "string" &&
    typeof candidate.recommendationId === "string" &&
    typeof candidate.dishIndex === "number" &&
    typeof candidate.stepIndex === "number" &&
    typeof candidate.dishTitle === "string" &&
    typeof candidate.stepText === "string" &&
    typeof candidate.durationSeconds === "number" &&
    typeof candidate.remainingSeconds === "number" &&
    (candidate.status === "running" ||
      candidate.status === "paused" ||
      candidate.status === "completed") &&
    (candidate.endsAt === null || typeof candidate.endsAt === "number") &&
    (candidate.notificationId === null ||
      typeof candidate.notificationId === "string") &&
    typeof candidate.notificationsAllowed === "boolean"
  );
}

async function persistCookingTimer(timer: CookingTimer | null) {
  if (timer) {
    await AsyncStorage.setItem(COOKING_TIMER_STORAGE_KEY, JSON.stringify(timer));
  } else {
    await AsyncStorage.removeItem(COOKING_TIMER_STORAGE_KEY);
  }
}

async function scheduleTimerNotification(
  input: StartCookingTimerInput,
  seconds: number,
) {
  try {
    return await scheduleCookingTimerNotification({
      seconds,
      dishTitle: input.dishTitle,
      spaceId: input.spaceId,
      recommendationId: input.recommendationId,
      dishIndex: input.dishIndex,
      stepIndex: input.stepIndex,
    });
  } catch {
    return null;
  }
}

export function getCookingTimerRemainingSeconds(
  timer: CookingTimer,
  now = Date.now(),
) {
  if (timer.status === "completed") {
    return 0;
  }
  if (timer.status === "paused" || timer.endsAt === null) {
    return Math.max(0, Math.ceil(timer.remainingSeconds));
  }
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

export function getCookingTimerProgress(
  durationSeconds: number,
  remainingSeconds: number,
) {
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(1, durationSeconds)
    : 1;
  const remaining = Number.isFinite(remainingSeconds)
    ? Math.min(duration, Math.max(0, remainingSeconds))
    : duration;

  return (duration - remaining) / duration;
}

export function isCookingTimerForStep(
  timer: CookingTimer | null,
  recommendationId: string,
  dishIndex: number,
  stepIndex: number,
) {
  return Boolean(
    timer &&
      timer.recommendationId === recommendationId &&
      timer.dishIndex === dishIndex &&
      timer.stepIndex === stepIndex,
  );
}

export function formatCookingTimerClock(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  const minuteSecond = `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${minuteSecond}` : minuteSecond;
}

export function formatCookingTimerDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  if (!minutes) return `${remainingSeconds}초`;
  if (!remainingSeconds) return `${minutes}분`;
  return `${minutes}분 ${remainingSeconds}초`;
}

export function getCookingTimerAccessibilityLabel(
  stepIndex: number,
  status: CookingTimerStatus,
  remainingSeconds: number,
) {
  if (status === "completed") {
    return `${stepIndex + 1}단계 타이머 완료`;
  }
  const state = status === "paused" ? "일시정지, " : "";
  return `${stepIndex + 1}단계 타이머, ${state}${formatCookingTimerDuration(
    remainingSeconds,
  )} 남음`;
}

export async function loadCookingTimer(ownerKey: string) {
  const stored = await AsyncStorage.getItem(COOKING_TIMER_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (isCookingTimer(parsed)) {
      return parsed.ownerKey === ownerKey ? parsed : null;
    }

    const legacyNotificationId =
      parsed &&
      typeof parsed === "object" &&
      "notificationId" in parsed &&
      typeof parsed.notificationId === "string"
        ? parsed.notificationId
        : null;
    await cancelScheduledNotification(legacyNotificationId).catch(() => undefined);
    await persistCookingTimer(null);
    return null;
  } catch {
    await persistCookingTimer(null);
    return null;
  }
}

export async function startCookingTimer(
  input: StartCookingTimerInput,
  now = Date.now(),
) {
  const durationSeconds = Math.max(1, Math.round(input.durationSeconds));
  const notificationId = await scheduleTimerNotification(input, durationSeconds);
  const timer: CookingTimer = {
    ...input,
    version: 2,
    durationSeconds,
    remainingSeconds: durationSeconds,
    status: "running",
    endsAt: now + durationSeconds * 1000,
    notificationId,
    notificationsAllowed: notificationId !== null,
  };
  await persistCookingTimer(timer);
  return timer;
}

export async function pauseCookingTimer(timer: CookingTimer, now = Date.now()) {
  const remainingSeconds = getCookingTimerRemainingSeconds(timer, now);
  await cancelScheduledNotification(timer.notificationId).catch(() => undefined);
  const next: CookingTimer = {
    ...timer,
    status: remainingSeconds > 0 ? "paused" : "completed",
    remainingSeconds,
    endsAt: null,
    notificationId: null,
  };
  await persistCookingTimer(next);
  return next;
}

export async function resumeCookingTimer(timer: CookingTimer, now = Date.now()) {
  const remainingSeconds = Math.max(1, timer.remainingSeconds);
  const notificationId = await scheduleTimerNotification(timer, remainingSeconds);
  const next: CookingTimer = {
    ...timer,
    status: "running",
    remainingSeconds,
    endsAt: now + remainingSeconds * 1000,
    notificationId,
    notificationsAllowed: notificationId !== null,
  };
  await persistCookingTimer(next);
  return next;
}

export async function completeCookingTimer(timer: CookingTimer) {
  const next: CookingTimer = {
    ...timer,
    status: "completed",
    remainingSeconds: 0,
    endsAt: null,
    notificationId: null,
  };
  await persistCookingTimer(next);
  return next;
}

export async function cancelCookingTimer(timer: CookingTimer | null) {
  await cancelScheduledNotification(timer?.notificationId ?? null).catch(
    () => undefined,
  );
  await persistCookingTimer(null);
}

export async function clearPersistedCookingTimer() {
  const stored = await AsyncStorage.getItem(COOKING_TIMER_STORAGE_KEY);
  let timer: CookingTimer | null = null;
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      timer = isCookingTimer(parsed) ? parsed : null;
    } catch {
      timer = null;
    }
  }
  await cancelCookingTimer(timer);
}
