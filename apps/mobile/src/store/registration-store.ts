import type { ProductCategory } from "@expirymate/shared";
import { create } from "zustand";

export interface RegistrationPrefill {
  productId?: string;
  barcode?: string;
  displayName?: string;
  brand?: string;
  category?: ProductCategory;
}

interface RegistrationState {
  prefill: RegistrationPrefill | null;
  setPrefill: (prefill: RegistrationPrefill | null) => void;
  clearPrefill: () => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  prefill: null,
  setPrefill: (prefill) => set({ prefill }),
  clearPrefill: () => set({ prefill: null }),
}));
