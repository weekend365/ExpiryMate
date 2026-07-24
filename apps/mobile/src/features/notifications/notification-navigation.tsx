import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
  getNotificationNavigationPath,
  getNotificationResponseData,
  getNotificationResponseId,
  NOTIFICATION_TYPES,
} from "../../services/notifications";
import { useAppStore } from "../../store/app-store";
import { useAuth } from "../auth/use-auth";
import { acknowledgeRecipeGenerationState } from "../recipes/recipe-generation-reset";
import { useActiveSpace } from "../spaces/space-provider";

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
  const { setActiveSpaceId } = useActiveSpace();
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

      const data = getNotificationResponseData(response);
      const path = getNotificationNavigationPath(data);

      if (!path) {
        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        data.type === NOTIFICATION_TYPES.recipeReady
      ) {
        acknowledgeRecipeGenerationState();
      }

      if (
        data &&
        typeof data === "object" &&
        "spaceId" in data &&
        typeof data.spaceId === "string" &&
        data.spaceId
      ) {
        setActiveSpaceId(data.spaceId);
      }

      handledResponseIdRef.current = responseId;
      router.push(path);
      void Notifications.clearLastNotificationResponseAsync();
    },
    [router, setActiveSpaceId],
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
