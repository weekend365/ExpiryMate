import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
  getNotificationNavigationPath,
  getNotificationResponseData,
  getNotificationResponseId,
} from "../../services/notifications";
import { useAppStore } from "../../store/app-store";
import { useAuth } from "../auth/use-auth";

/**
 * Opens the matching in-app screen when the user taps a notification
 * (warm start via listener, cold start via last response).
 */
export function NotificationNavigationBridge() {
  const router = useRouter();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding,
  );
  const { query } = useAuth();
  const handledResponseIdRef = useRef<string | null>(null);

  const canNavigate =
    hasHydrated &&
    hasCompletedOnboarding &&
    !query.isLoading &&
    query.data?.accountType === "registered" &&
    !query.data?.requiresEmailVerification;

  const navigateFromResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseId = getNotificationResponseId(response);

      if (handledResponseIdRef.current === responseId) {
        return;
      }

      const path = getNotificationNavigationPath(
        getNotificationResponseData(response),
      );

      if (!path) {
        return;
      }

      handledResponseIdRef.current = responseId;
      router.push(path);
      void Notifications.clearLastNotificationResponseAsync();
    },
    [router],
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (!canNavigate) {
          return;
        }

        navigateFromResponse(response);
      },
    );

    return () => {
      subscription.remove();
    };
  }, [canNavigate, navigateFromResponse]);

  useEffect(() => {
    if (!canNavigate) {
      return;
    }

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromResponse(response);
      }
    });
  }, [canNavigate, navigateFromResponse]);

  return null;
}
