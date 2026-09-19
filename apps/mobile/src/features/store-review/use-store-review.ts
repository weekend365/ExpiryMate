import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, InteractionManager, Keyboard } from "react-native";
import { useAuth } from "../auth/use-auth";
import { useActiveSpace } from "../spaces/space-provider";
import { reviewService } from "./store-review";

export function ReviewSessionBridge() {
  const { sessionUserId } = useAuth();
  useEffect(() => { reviewService.setSession(sessionUserId); }, [sessionUserId]);
  return null;
}

export function useStoreReview(blocked: boolean) {
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const revision = useSyncExternalStore(reviewService.subscribe, reviewService.getSnapshot);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const safe = useRef(false);
  safe.current = !blocked && active && !keyboard;

  useEffect(() => {
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") safe.current = false;
      setActive(state === "active");
    });
    const show = Keyboard.addListener("keyboardDidShow", () => { safe.current = false; setKeyboard(true); });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    const willShow = Keyboard.addListener("keyboardWillShow", () => { safe.current = false; setKeyboard(true); });
    return () => { app.remove(); show.remove(); hide.remove(); willShow.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (!sessionUserId || !activeSpaceId || blocked || !active || keyboard) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void reviewService.tryRequest(sessionUserId, () => !cancelled && safe.current &&
          AppState.currentState === "active" && !Keyboard.isVisible() &&
          reviewService.getSnapshot() === revision);
      }, 2000);
    });
    return () => { cancelled = true; interaction.cancel(); clearTimeout(timer); };
  }, [sessionUserId, activeSpaceId, blocked, active, keyboard, revision]));
}
