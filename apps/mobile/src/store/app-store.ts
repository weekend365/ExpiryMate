import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { captureStartupBootstrapIssue } from "../services/bootstrap-diagnostics";

export const APP_STORE_HYDRATION_TIMEOUT_MS = 6_000;
const APP_STORE_PERSIST_VERSION = 1;

export type PendingCookingCleanup = {
  recommendationId: string;
  dishIndex: number;
  dishTitle: string;
  createdAt: number;
};

interface AppStoreState {
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
  keepCookingScreenAwake: boolean;
  pendingCookingCleanup: PendingCookingCleanup | null;
  completeOnboarding: () => void;
  finishHydration: () => void;
  setKeepCookingScreenAwake: (enabled: boolean) => void;
  setPendingCookingCleanup: (cleanup: PendingCookingCleanup | null) => void;
}

type PersistedAppStoreState = Pick<
  AppStoreState,
  | "hasCompletedOnboarding"
  | "keepCookingScreenAwake"
  | "pendingCookingCleanup"
>;

let hydrationWatchdog: ReturnType<typeof setTimeout> | undefined;

function finishHydration(error?: unknown) {
  if (hydrationWatchdog) {
    clearTimeout(hydrationWatchdog);
    hydrationWatchdog = undefined;
  }
  if (error) {
    captureStartupBootstrapIssue("app-store.hydrate", error);
  }
  // Use the store API even when Zustand could not deserialize a `state` value.
  // Optional-chaining the callback state would otherwise leave this false.
  useAppStore.setState({ hasHydrated: true });
}

export function normalizePersistedAppStoreState(
  value: unknown,
): PersistedAppStoreState {
  const persisted =
    value && typeof value === "object"
      ? (value as Partial<PersistedAppStoreState>)
      : {};

  return {
    hasCompletedOnboarding:
      typeof persisted.hasCompletedOnboarding === "boolean"
        ? persisted.hasCompletedOnboarding
        : false,
    keepCookingScreenAwake:
      typeof persisted.keepCookingScreenAwake === "boolean"
        ? persisted.keepCookingScreenAwake
        : true,
    pendingCookingCleanup: isPendingCookingCleanup(
      persisted.pendingCookingCleanup,
    )
      ? persisted.pendingCookingCleanup ?? null
      : null,
  };
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      hasHydrated: false,
      keepCookingScreenAwake: true,
      pendingCookingCleanup: null,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      finishHydration: () => set({ hasHydrated: true }),
      setKeepCookingScreenAwake: (enabled) =>
        set({ keepCookingScreenAwake: enabled }),
      setPendingCookingCleanup: (cleanup) =>
        set({ pendingCookingCleanup: cleanup }),
    }),
    {
      name: "expirymate-app-store",
      storage: createJSONStorage(() => AsyncStorage),
      version: APP_STORE_PERSIST_VERSION,
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        keepCookingScreenAwake: state.keepCookingScreenAwake,
        pendingCookingCleanup: state.pendingCookingCleanup,
      }),
      migrate: (persistedState) =>
        normalizePersistedAppStoreState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedAppStoreState(persistedState),
        // Hydration is process-local and must never be restored from disk.
        hasHydrated: currentState.hasHydrated,
      }),
      onRehydrateStorage: () => (_state, error) => {
        finishHydration(error);
      },
    },
  ),
);

hydrationWatchdog = setTimeout(() => {
  if (useAppStore.getState().hasHydrated) {
    return;
  }

  const error = new Error("App state hydration did not settle before timeout.");
  captureStartupBootstrapIssue("app-store.hydrate-timeout", error, {
    timeout_ms: APP_STORE_HYDRATION_TIMEOUT_MS,
  });
  finishHydration();
}, APP_STORE_HYDRATION_TIMEOUT_MS);

// Do not keep Node-based unit tests alive solely for the startup watchdog.
(hydrationWatchdog as unknown as { unref?: () => void }).unref?.();

function isPendingCookingCleanup(
  value: unknown,
): value is PendingCookingCleanup | null {
  if (value === null) {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }

  const cleanup = value as Partial<PendingCookingCleanup>;
  return (
    typeof cleanup.recommendationId === "string" &&
    typeof cleanup.dishIndex === "number" &&
    typeof cleanup.dishTitle === "string" &&
    typeof cleanup.createdAt === "number"
  );
}
