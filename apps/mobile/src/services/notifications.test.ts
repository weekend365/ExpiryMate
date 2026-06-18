import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notifications: {
    AndroidImportance: {
      DEFAULT: 3,
    },
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(),
    requestPermissionsAsync: vi.fn(),
    getExpoPushTokenAsync: vi.fn(),
    scheduleNotificationAsync: vi.fn(),
    setNotificationChannelAsync: vi.fn(),
  },
  api: {
    registerPushToken: vi.fn(),
  },
  platform: {
    Platform: {
      OS: "ios",
    },
  },
}));

vi.mock("expo-notifications", () => mocks.notifications);
vi.mock("./api", () => mocks.api);
vi.mock("react-native", () => mocks.platform);
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "1.0.0",
      extra: {
        eas: {
          projectId: "project-1",
        },
      },
    },
    easConfig: {
      projectId: "fallback-project",
    },
  },
}));

describe("mobile notification service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.platform.Platform.OS = "ios";
  });

  it("gets and registers the Expo push token after permission is granted", async () => {
    mocks.notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    mocks.notifications.getExpoPushTokenAsync.mockResolvedValue({
      data: "ExpoPushToken[token]",
    });
    mocks.api.registerPushToken.mockResolvedValue({
      id: "push-token-1",
      token: "ExpoPushToken[token]",
    });
    const { registerDevicePushToken } = await import("./notifications");

    const result = await registerDevicePushToken();

    expect(result).toMatchObject({
      id: "push-token-1",
      token: "ExpoPushToken[token]",
    });
    expect(mocks.notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "project-1",
    });
    expect(mocks.api.registerPushToken).toHaveBeenCalledWith({
      token: "ExpoPushToken[token]",
      platform: "ios",
      appVersion: "1.0.0",
    });
  });

  it("does not request permissions during silent startup sync", async () => {
    mocks.notifications.getPermissionsAsync.mockResolvedValue({ granted: false });
    const { syncPushTokenIfPermissionGranted } = await import("./notifications");

    const result = await syncPushTokenIfPermissionGranted();

    expect(result).toBeNull();
    expect(mocks.notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mocks.api.registerPushToken).not.toHaveBeenCalled();
  });

  it("configures the Android notification channel before registering", async () => {
    mocks.platform.Platform.OS = "android";
    mocks.notifications.getPermissionsAsync.mockResolvedValue({ granted: true });
    mocks.notifications.getExpoPushTokenAsync.mockResolvedValue({
      data: "ExpoPushToken[android-token]",
    });
    mocks.api.registerPushToken.mockResolvedValue({
      id: "push-token-1",
      token: "ExpoPushToken[android-token]",
    });
    const { registerDevicePushToken } = await import("./notifications");

    await registerDevicePushToken();

    expect(mocks.notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "expiry-reminders",
      expect.objectContaining({
        name: "유통기한 알림",
        importance: 3,
      }),
    );
    expect(mocks.api.registerPushToken).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "android",
      }),
    );
  });
});
