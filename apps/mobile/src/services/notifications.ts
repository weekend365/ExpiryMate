import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "./api";

export const NOTIFICATION_TYPES = {
  recipeReady: "recipe_ready",
  expiryReminder: "expiry_reminder",
  cookingTimer: "cooking_timer",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type LocalNotificationData = {
  type: NotificationType | string;
  recommendationId?: string;
  inventoryItemId?: string;
  dishIndex?: number;
  stepIndex?: number;
};

export type NotificationNavigationPath =
  | "/(tabs)/recommendations"
  | "/(tabs)/inventory"
  | `/inventory/${string}`
  | `/cooking/${string}?dishIndex=${number}&stepIndex=${number}`;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const shouldPlaySound =
      notification.request.content.data?.type === NOTIFICATION_TYPES.cookingTimer;

    return {
      shouldPlaySound,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export const requestNotificationPermissions = async () => {
  await ensureAndroidNotificationChannel();
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.granted) {
    return permissions;
  }

  return Notifications.requestPermissionsAsync();
};

export const registerDevicePushToken = async () => {
  const permissions = await requestNotificationPermissions();

  if (!permissions.granted) {
    return null;
  }

  return registerCurrentPushToken();
};

export const syncPushTokenIfPermissionGranted = async () => {
  await ensureAndroidNotificationChannel();
  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    return null;
  }

  return registerCurrentPushToken();
};

/** Best-effort: disable this device token for the current authenticated owner. */
export const unregisterDevicePushToken = async () => {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) {
      return { ok: true as const, skipped: true as const };
    }

    const token = await getExpoPushToken();
    await unregisterPushToken(token);
    return { ok: true as const, skipped: false as const };
  } catch {
    return { ok: false as const, skipped: false as const };
  }
};

export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data?: LocalNotificationData,
) => {
  const permissions = await requestNotificationPermissions();

  if (!permissions.granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      ...(data ? { data } : {}),
    },
    trigger: null,
  });
};

export const scheduleMockExpiryReminder = scheduleLocalNotification;

export async function scheduleCookingTimerNotification(input: {
  seconds: number;
  dishTitle: string;
  recommendationId: string;
  dishIndex: number;
  stepIndex: number;
}) {
  await ensureCookingTimerChannel();
  const permissions = await Notifications.getPermissionsAsync();
  const resolvedPermissions = permissions.granted
    ? permissions
    : await Notifications.requestPermissionsAsync();

  if (!resolvedPermissions.granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `${input.dishTitle} 타이머가 끝났어요`,
      body: `${input.stepIndex + 1}단계를 확인해 주세요.`,
      sound: "default",
      data: {
        type: NOTIFICATION_TYPES.cookingTimer,
        recommendationId: input.recommendationId,
        dishIndex: input.dishIndex,
        stepIndex: input.stepIndex,
      } satisfies LocalNotificationData,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: input.seconds,
      ...(Platform.OS === "android" ? { channelId: "cooking-timers" } : {}),
    },
  });
}

export async function cancelScheduledNotification(identifier: string | null) {
  if (!identifier) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export function getNotificationNavigationPath(
  data: unknown,
): NotificationNavigationPath | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = "type" in data ? data.type : undefined;

  if (type === NOTIFICATION_TYPES.recipeReady) {
    return "/(tabs)/recommendations";
  }

  if (type === NOTIFICATION_TYPES.expiryReminder) {
    const inventoryItemId =
      "inventoryItemId" in data && typeof data.inventoryItemId === "string"
        ? data.inventoryItemId.trim()
        : "";

    if (inventoryItemId) {
      return `/inventory/${inventoryItemId}`;
    }

    return "/(tabs)/inventory";
  }

  if (type === NOTIFICATION_TYPES.cookingTimer) {
    const recommendationId =
      "recommendationId" in data && typeof data.recommendationId === "string"
        ? data.recommendationId.trim()
        : "";
    const dishIndex =
      "dishIndex" in data && typeof data.dishIndex === "number"
        ? data.dishIndex
        : -1;
    const stepIndex =
      "stepIndex" in data && typeof data.stepIndex === "number"
        ? data.stepIndex
        : -1;

    if (recommendationId && dishIndex >= 0 && stepIndex >= 0) {
      return `/cooking/${encodeURIComponent(recommendationId)}?dishIndex=${dishIndex}&stepIndex=${stepIndex}`;
    }
  }

  return null;
}

export function getNotificationResponseId(
  response: Notifications.NotificationResponse,
) {
  return response.notification.request.identifier;
}

export function getNotificationResponseData(
  response: Notifications.NotificationResponse,
) {
  return response.notification.request.content.data;
}

async function registerCurrentPushToken() {
  const token = await getExpoPushToken();

  return registerPushToken({
    token,
    platform: getPushTokenPlatform(),
    appVersion: Constants.expoConfig?.version,
  });
}

async function getExpoPushToken() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return tokenResponse.data;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("expiry-reminders", {
    name: "유통기한 알림",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function ensureCookingTimerChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("cooking-timers", {
    name: "조리 타이머",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

function getPushTokenPlatform() {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") {
    return Platform.OS;
  }

  return "unknown";
}
