import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ExpirySource,
  type ProductCategory,
} from "@expirymate/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface RegistrationPrefill {
  productId?: string;
  displayName?: string;
  brand?: string;
  category?: ProductCategory;
}

export interface RegistrationDraft extends RegistrationPrefill {
  quantity?: number;
  unit?: string;
  storageLocation?: string;
  expiryDate?: string;
  expirySource?: ExpirySource;
  notes?: string;
}

interface RegistrationState {
  hasHydrated: boolean;
  prefill: RegistrationPrefill | null;
  draft: RegistrationDraft | null;
  finishHydration: () => void;
  setPrefill: (prefill: RegistrationPrefill | null) => void;
  setDraft: (draft: RegistrationDraft | null) => void;
  clearPrefill: () => void;
  clearDraft: () => void;
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      prefill: null,
      draft: null,
      finishHydration: () => set({ hasHydrated: true }),
      setPrefill: (prefill) => set({ prefill }),
      setDraft: (draft) => set({ draft }),
      clearPrefill: () => set({ prefill: null }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: "expirymate-registration-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        prefill: state.prefill,
        draft: state.draft,
      }),
      onRehydrateStorage: () => (state) => {
        state?.finishHydration();
      },
    },
  ),
);
