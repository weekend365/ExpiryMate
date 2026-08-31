import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
      onRehydrateStorage: () => (state) => {
        state?.finishHydration();
      },
    },
  ),
);
