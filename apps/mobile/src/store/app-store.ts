import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AppStoreState {
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
  completeOnboarding: () => void;
  finishHydration: () => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      hasHydrated: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      finishHydration: () => set({ hasHydrated: true }),
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
