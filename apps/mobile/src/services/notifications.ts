import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken } from "./api";

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

export const scheduleLocalNotification = async (title: string, body: string) => {
  const permissions = await requestNotificationPermissions();

  if (!permissions.granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: null,
  });
};

export const scheduleMockExpiryReminder = scheduleLocalNotification;

async function registerCurrentPushToken() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return registerPushToken({
    token: tokenResponse.data,
    platform: getPushTokenPlatform(),
    appVersion: Constants.expoConfig?.version,
  });
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
