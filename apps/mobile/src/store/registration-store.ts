import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ExpirySource,
  type BarcodeRewardReason,
  type ProductCategory,
} from "@expirymate/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PhotoIntakeDraftItem } from "../features/photo-intake/photo-intake-draft";

export type IngredientEntryMethod = "scan" | "photo" | "manual";

export interface RegistrationPrefill {
  productId?: string;
  productMasterId?: string;
  catalogName?: string;
  catalogBrand?: string;
  displayName?: string;
  brand?: string;
  category?: ProductCategory;
}

export interface RegistrationDraft extends RegistrationPrefill {
  quantity?: number;
  unit?: string;
  storageLocation?: string;
  expiryDate?: string | null;
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
  prefills: Record<string, RegistrationPrefill>;
  drafts: Record<string, RegistrationDraft>;
  lastStorageLocations: Record<string, string>;
  preferredEntryMethods: Record<string, IngredientEntryMethod>;
  photoDrafts: Record<string, PhotoIntakeDraftItem[]>;
  rewardNotice: RegistrationRewardNotice | null;
  finishHydration: () => void;
  setPrefill: (spaceId: string, prefill: RegistrationPrefill | null) => void;
  setDraft: (spaceId: string, draft: RegistrationDraft | null) => void;
  setLastStorageLocation: (spaceId: string, storageLocation: string) => void;
  setPreferredEntryMethod: (
    spaceId: string,
    method: IngredientEntryMethod,
  ) => void;
  setPhotoDraft: (spaceId: string, items: PhotoIntakeDraftItem[] | null) => void;
  setRewardNotice: (notice: RegistrationRewardNotice | null) => void;
  clearPrefill: (spaceId?: string) => void;
  clearDraft: (spaceId?: string) => void;
  clearLastStorageLocation: (spaceId?: string) => void;
  clearPreferredEntryMethod: (spaceId?: string) => void;
  clearPhotoDraft: (spaceId?: string) => void;
}

export function prefillForSpace(
  state: Pick<RegistrationState, "prefills">,
  spaceId: string | undefined,
) {
  return spaceId ? (state.prefills[spaceId] ?? null) : null;
}

export function draftForSpace(
  state: Pick<RegistrationState, "drafts">,
  spaceId: string | undefined,
) {
  return spaceId ? (state.drafts[spaceId] ?? null) : null;
}

export function lastStorageLocationForSpace(
  state: Pick<RegistrationState, "lastStorageLocations">,
  spaceId: string | undefined,
) {
  return spaceId ? (state.lastStorageLocations[spaceId] ?? null) : null;
}

export function preferredEntryMethodForSpace(
  state: Pick<RegistrationState, "preferredEntryMethods">,
  spaceId: string | undefined,
) {
  return spaceId ? (state.preferredEntryMethods[spaceId] ?? null) : null;
}

export function photoDraftForSpace(
  state: Pick<RegistrationState, "photoDrafts">,
  spaceId: string | undefined,
) {
  return spaceId ? (state.photoDrafts[spaceId] ?? null) : null;
}

function writeRecord<T>(
  record: Record<string, T>,
  spaceId: string,
  value: T | null,
): Record<string, T> {
  if (value == null) {
    return omitRecordKey(record, spaceId);
  }

  return { ...record, [spaceId]: value };
}

function omitRecordKey<T>(record: Record<string, T>, spaceId: string) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== spaceId),
  ) as Record<string, T>;
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      prefills: {},
      drafts: {},
      lastStorageLocations: {},
      preferredEntryMethods: {},
      photoDrafts: {},
      rewardNotice: null,
      finishHydration: () => set({ hasHydrated: true }),
      setPrefill: (spaceId, prefill) =>
        set((state) => ({
          prefills: writeRecord(state.prefills, spaceId, prefill),
        })),
      setDraft: (spaceId, draft) =>
        set((state) => ({
          drafts: writeRecord(state.drafts, spaceId, draft),
        })),
      setLastStorageLocation: (spaceId, lastStorageLocation) =>
        set((state) => ({
          lastStorageLocations: {
            ...state.lastStorageLocations,
            [spaceId]: lastStorageLocation,
          },
        })),
      setPreferredEntryMethod: (spaceId, method) =>
        set((state) => ({
          preferredEntryMethods: {
            ...state.preferredEntryMethods,
            [spaceId]: method,
          },
        })),
      setPhotoDraft: (spaceId, items) =>
        set((state) => ({
          photoDrafts: writeRecord(
            state.photoDrafts,
            spaceId,
            items?.length ? items : null,
          ),
        })),
      setRewardNotice: (rewardNotice) => set({ rewardNotice }),
      clearPrefill: (spaceId) =>
        set((state) => ({
          prefills: spaceId
            ? omitRecordKey(state.prefills, spaceId)
            : {},
        })),
      clearDraft: (spaceId) =>
        set((state) => ({
          drafts: spaceId ? omitRecordKey(state.drafts, spaceId) : {},
        })),
      clearLastStorageLocation: (spaceId) =>
        set((state) => ({
          lastStorageLocations: spaceId
            ? omitRecordKey(state.lastStorageLocations, spaceId)
            : {},
        })),
      clearPreferredEntryMethod: (spaceId) =>
        set((state) => ({
          preferredEntryMethods: spaceId
            ? omitRecordKey(state.preferredEntryMethods, spaceId)
            : {},
        })),
      clearPhotoDraft: (spaceId) =>
        set((state) => ({
          photoDrafts: spaceId ? omitRecordKey(state.photoDrafts, spaceId) : {},
        })),
    }),
    {
      name: "expirymate-registration-store.v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        prefills: state.prefills,
        drafts: state.drafts,
        lastStorageLocations: state.lastStorageLocations,
        preferredEntryMethods: state.preferredEntryMethods,
        photoDrafts: state.photoDrafts,
      }),
      onRehydrateStorage: () => (state) => {
        state?.finishHydration();
      },
    },
  ),
);
