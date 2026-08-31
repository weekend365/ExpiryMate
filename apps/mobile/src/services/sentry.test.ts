import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
}));

vi.mock("@sentry/react-native", () => ({
  init: mocks.init,
  addBreadcrumb: vi.fn(),
}));
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "1.2.3",
      ios: { buildNumber: "45" },
    },
  },
}));

describe("mobile Sentry initialization", () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const originalAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
    if (originalAppEnv === undefined) {
      delete process.env.EXPO_PUBLIC_APP_ENV;
    } else {
      process.env.EXPO_PUBLIC_APP_ENV = originalAppEnv;
    }
  });

  it("stays disabled in development so the root is not wrapped prematurely", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.invalid/1";
    process.env.EXPO_PUBLIC_APP_ENV = "development";
    const { initMobileSentry } = await import("./sentry");

    expect(initMobileSentry()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it("reports that Sentry is enabled after production initialization", async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://public@example.invalid/1";
    process.env.EXPO_PUBLIC_APP_ENV = "production";
    const { initMobileSentry } = await import("./sentry");

    expect(initMobileSentry()).toBe(true);
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "production",
        release: "expirymate-mobile@1.2.3+45",
      }),
    );
  });
});
