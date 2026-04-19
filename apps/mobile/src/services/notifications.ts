import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async () => {
  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.granted) {
    return permissions;
  }

  return Notifications.requestPermissionsAsync();
};

export const scheduleMockExpiryReminder = async (title: string, body: string) => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: null,
  });
};
