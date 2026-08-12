import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ExpirySource,
  type BarcodeRewardReason,
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

export interface RegistrationRewardNotice {
  granted: boolean;
  reason: BarcodeRewardReason;
  creditsGranted: number;
  balance: number;
  balanceLimit: number;
}

interface RegistrationState {
  hasHydrated: boolean;
  prefill: RegistrationPrefill | null;
  draft: RegistrationDraft | null;
  rewardNotice: RegistrationRewardNotice | null;
  finishHydration: () => void;
  setPrefill: (prefill: RegistrationPrefill | null) => void;
  setDraft: (draft: RegistrationDraft | null) => void;
  setRewardNotice: (notice: RegistrationRewardNotice | null) => void;
  clearPrefill: () => void;
  clearDraft: () => void;
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      prefill: null,
      draft: null,
      rewardNotice: null,
      finishHydration: () => set({ hasHydrated: true }),
      setPrefill: (prefill) => set({ prefill }),
      setDraft: (draft) => set({ draft }),
      setRewardNotice: (rewardNotice) => set({ rewardNotice }),
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
