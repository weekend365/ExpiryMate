import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "./api";

export const NOTIFICATION_TYPES = {
  recipeReady: "recipe_ready",
  expiryReminder: "expiry_reminder",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type LocalNotificationData = {
  type: NotificationType | string;
  recommendationId?: string;
  inventoryItemId?: string;
};

export type NotificationNavigationPath = "/(tabs)/recommendations";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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

function getPushTokenPlatform() {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") {
    return Platform.OS;
  }

  return "unknown";
}
