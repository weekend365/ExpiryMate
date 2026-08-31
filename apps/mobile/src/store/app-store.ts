import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AppStoreState {
  hasCompletedOnboarding: boolean;
  hasHydrated: boolean;
  keepCookingScreenAwake: boolean;
  completeOnboarding: () => void;
  finishHydration: () => void;
  setKeepCookingScreenAwake: (enabled: boolean) => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      hasHydrated: false,
      keepCookingScreenAwake: true,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      finishHydration: () => set({ hasHydrated: true }),
      setKeepCookingScreenAwake: (enabled) =>
        set({ keepCookingScreenAwake: enabled }),
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
