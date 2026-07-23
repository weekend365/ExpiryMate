import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
} from "../enums/app-enums";

export const storageLocationLabels: Record<StorageLocation, string> = {
  [StorageLocation.FRIDGE]: "냉장",
  [StorageLocation.FREEZER]: "냉동",
  [StorageLocation.ROOM]: "실온",
  [StorageLocation.BATHROOM]: "욕실",
  [StorageLocation.KITCHEN]: "주방",
};

/** Fixed system keys users can pick. Bathroom stays for legacy rows only. */
export const SYSTEM_STORAGE_LOCATION_KEYS = [
  StorageLocation.FRIDGE,
  StorageLocation.FREEZER,
  StorageLocation.ROOM,
  StorageLocation.KITCHEN,
] as const;

export type SystemStorageLocationKey =
  (typeof SYSTEM_STORAGE_LOCATION_KEYS)[number];

/** @deprecated Prefer SYSTEM_STORAGE_LOCATION_KEYS */
export const selectableStorageLocations: StorageLocation[] = [
  ...SYSTEM_STORAGE_LOCATION_KEYS,
];

export const isSystemStorageLocationKey = (
  key: string,
): key is SystemStorageLocationKey =>
  (SYSTEM_STORAGE_LOCATION_KEYS as readonly string[]).includes(key);

export const isKnownStorageLocationKey = (key: string): key is StorageLocation =>
  Object.values(StorageLocation).includes(key as StorageLocation);

export type StorageLocationLabelSource = {
  key: string;
  label: string;
};

/** Resolve a display label for a system, legacy, or custom storage key. */
export const resolveStorageLocationLabel = (
  key: string,
  customLocations: StorageLocationLabelSource[] = [],
): string => {
  if (isKnownStorageLocationKey(key)) {
    return storageLocationLabels[key];
  }

  const custom = customLocations.find((location) => location.key === key);
  return custom?.label ?? key;
};

export const itemStatusLabels: Record<ItemStatus, string> = {
  [ItemStatus.ACTIVE]: "보관 중",
  [ItemStatus.CONSUMED]: "소비 완료",
  [ItemStatus.DISCARDED]: "폐기",
  [ItemStatus.EXPIRED]: "만료",
};

export const expirySourceLabels: Record<ExpirySource, string> = {
  [ExpirySource.MANUAL]: "직접 입력",
  [ExpirySource.PRESET]: "빠른 선택",
  [ExpirySource.OCR_DETECTED]: "OCR 인식",
};

export const productCategoryLabels: Record<ProductCategory, string> = {
  [ProductCategory.DAIRY]: "유제품",
  [ProductCategory.EGG]: "계란",
  [ProductCategory.TOFU]: "두부/콩",
  [ProductCategory.BEVERAGE]: "음료",
  [ProductCategory.INSTANT_FOOD]: "간편식",
  [ProductCategory.PERSONAL_CARE]: "생활/욕실",
  [ProductCategory.PAPER_GOODS]: "종이/소모품",
  [ProductCategory.CLEANING]: "세제/청소",
  [ProductCategory.FROZEN_FOOD]: "냉동식품",
  [ProductCategory.PRODUCE]: "신선식품",
  [ProductCategory.SEASONING]: "조미료",
  [ProductCategory.SNACK]: "간식",
  [ProductCategory.HOUSEHOLD]: "생활용품",
};

export const storageLocationOptions = SYSTEM_STORAGE_LOCATION_KEYS.map(
  (value) => ({
    value,
    label: storageLocationLabels[value],
  }),
);

export const productCategoryOptions = Object.entries(productCategoryLabels).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const expiryPresetOptions = [
  { label: "오늘", days: 0 },
  { label: "3일 뒤", days: 3 },
  { label: "7일 뒤", days: 7 },
  { label: "14일 뒤", days: 14 },
  { label: "30일 뒤", days: 30 },
];
