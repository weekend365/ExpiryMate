import { useEffect, useRef } from "react";
import { AppState, Dimensions, type View } from "react-native";
import { isRectMeaningfullyVisible } from "./affiliate-visibility";

const POLL_INTERVAL_MS = 200;
const MIN_VISIBLE_MS = 300;

export function useVisibleImpression(input: {
  impressionKey: string;
  enabled?: boolean;
  onVisible: () => void;
}) {
  const ref = useRef<View>(null);
  const onVisibleRef = useRef(input.onVisible);
  onVisibleRef.current = input.onVisible;

  useEffect(() => {
    if (input.enabled === false) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let visibleSince: number | null = null;

    const schedule = () => {
      if (!cancelled) timeout = setTimeout(check, POLL_INTERVAL_MS);
    };
    const check = () => {
      if (cancelled) return;
      if (AppState.currentState !== "active" || !ref.current) {
        visibleSince = null;
        schedule();
        return;
      }
      ref.current.measureInWindow((x, y, width, height) => {
        if (cancelled) return;
        const viewport = Dimensions.get("window");
        const visible = isRectMeaningfullyVisible({
          x,
          y,
          width,
          height,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        });
        if (!visible) {
          visibleSince = null;
          schedule();
          return;
        }
        visibleSince ??= Date.now();
        if (Date.now() - visibleSince >= MIN_VISIBLE_MS) {
          onVisibleRef.current();
          return;
        }
        schedule();
      });
    };

    timeout = setTimeout(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [input.enabled, input.impressionKey]);

  return ref;
}
