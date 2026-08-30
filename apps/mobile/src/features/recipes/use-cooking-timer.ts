import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import {
  cancelCookingTimer,
  completeCookingTimer,
  getCookingTimerRemainingSeconds,
  loadCookingTimer,
  pauseCookingTimer,
  resumeCookingTimer,
  startCookingTimer,
  type CookingTimer,
  type StartCookingTimerInput,
} from "./cooking-timer";

export function useCookingTimer(ownerKey: string | undefined) {
  const [timer, setTimer] = useState<CookingTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const completionAlertKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsHydrated(false);
    setTimer(null);
    if (!ownerKey) {
      setIsHydrated(true);
      return () => {
        active = false;
      };
    }
    void loadCookingTimer(ownerKey)
      .then((stored) => {
        if (active) {
          setTimer(stored);
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (active) {
          setErrorMessage("저장된 타이머를 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (active) {
          setIsHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, [ownerKey]);

  useEffect(() => {
    if (timer?.status !== "running") {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer?.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(Date.now());
      }
    });
    return () => subscription.remove();
  }, []);

  const remainingSeconds = timer
    ? getCookingTimerRemainingSeconds(timer, now)
    : 0;

  useEffect(() => {
    if (!timer || timer.status !== "running" || remainingSeconds > 0) {
      return;
    }
    const completionKey = `${timer.recommendationId}:${timer.dishIndex}:${timer.stepIndex}:${timer.endsAt}`;
    setTimer({
      ...timer,
      status: "completed",
      remainingSeconds: 0,
      endsAt: null,
      notificationId: null,
    });
    void completeCookingTimer(timer).catch(() => undefined);
    if (!timer.notificationsAllowed && completionAlertKeyRef.current !== completionKey) {
      completionAlertKeyRef.current = completionKey;
      Alert.alert(
        `${timer.dishTitle} 타이머가 끝났어요`,
        `${timer.stepIndex + 1}단계를 확인해 주세요.`,
      );
    }
  }, [remainingSeconds, timer]);

  const run = useCallback(async <T,>(action: () => Promise<T>) => {
    setIsPending(true);
    setErrorMessage(null);
    try {
      return await action();
    } catch {
      setErrorMessage("타이머를 바꾸지 못했어요. 잠시 뒤 다시 눌러주세요.");
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  const start = useCallback(
    async (input: StartCookingTimerInput, replace = false) => {
      if (!ownerKey) {
        return null;
      }
      return run(async () => {
        if (replace && timer) {
          await cancelCookingTimer(timer);
        }
        const next = await startCookingTimer(input);
        setTimer(next);
        setNow(Date.now());
        return next;
      });
    },
    [ownerKey, run, timer],
  );

  const pause = useCallback(
    () =>
      run(async () => {
        if (!timer) return null;
        const next = await pauseCookingTimer(timer);
        setTimer(next);
        setNow(Date.now());
        return next;
      }),
    [run, timer],
  );

  const resume = useCallback(
    () =>
      run(async () => {
        if (!timer) return null;
        const next = await resumeCookingTimer(timer);
        setTimer(next);
        setNow(Date.now());
        return next;
      }),
    [run, timer],
  );

  const cancel = useCallback(
    () =>
      run(async () => {
        await cancelCookingTimer(timer);
        setTimer(null);
        return true;
      }),
    [run, timer],
  );

  return {
    timer,
    remainingSeconds,
    isHydrated,
    isPending,
    errorMessage,
    start,
    pause,
    resume,
    cancel,
  };
}
