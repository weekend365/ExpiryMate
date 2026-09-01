import { afterEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  getItem: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: () => storage.getItem(),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock("../services/bootstrap-diagnostics", () => ({
  captureStartupBootstrapIssue: vi.fn(),
}));

describe("app store hydration", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("finishes hydration when AsyncStorage rejects", async () => {
    storage.getItem.mockRejectedValueOnce(new Error("corrupt storage"));
    const { useAppStore } = await import("./app-store");

    await vi.waitFor(() => {
      expect(useAppStore.getState().hasHydrated).toBe(true);
    });
  });

  it("fails open when AsyncStorage never settles", async () => {
    vi.useFakeTimers();
    storage.getItem.mockImplementationOnce(
      () => new Promise<string | null>(() => undefined),
    );
    const { APP_STORE_HYDRATION_TIMEOUT_MS, useAppStore } = await import(
      "./app-store"
    );

    expect(useAppStore.getState().hasHydrated).toBe(false);
    await vi.advanceTimersByTimeAsync(APP_STORE_HYDRATION_TIMEOUT_MS);
    expect(useAppStore.getState().hasHydrated).toBe(true);
  });

  it("drops process-only and malformed fields during migration", async () => {
    storage.getItem.mockResolvedValueOnce(null);
    const { normalizePersistedAppStoreState } = await import("./app-store");

    expect(
      normalizePersistedAppStoreState({
        hasCompletedOnboarding: true,
        hasHydrated: true,
        keepCookingScreenAwake: "yes",
        pendingCookingCleanup: { recommendationId: "broken" },
      }),
    ).toEqual({
      hasCompletedOnboarding: true,
      keepCookingScreenAwake: true,
      pendingCookingCleanup: null,
    });
  });
});
