import {
  type InventoryItem as PrismaInventoryItem,
  type NotificationPreference as PrismaNotificationPreference,
  type Product as PrismaProduct,
  type ProductMaster as PrismaProductMaster,
  type PushToken as PrismaPushToken,
  type UserStorageLocation as PrismaUserStorageLocation,
} from "@prisma/client";
import { createHash } from "node:crypto";
import {
  calculateDaysLeftUntilExpiry,
  ExpirySource,
  type InventoryItem,
  ItemStatus,
  type NotificationPreference,
  type Product,
  ProductCategory,
  type ProductMaster,
  ProductMasterSource,
  type PushToken,
  type PushTokenPlatform,
  UnitCode,
  type UserStorageLocation,
  toKstDateOnly,
} from "@expirymate/shared";

export const serializeProduct = (product: PrismaProduct): Product => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: product.category as ProductCategory,
  imageUrl: product.imageUrl,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

export const serializeProductMaster = (
  product: PrismaProductMaster,
): ProductMaster => ({
  id: product.id,
  barcode: product.barcode,
  name: product.name,
  brand: product.brand,
  category: product.category,
  imageUrl: product.imageUrl,
  source: product.source as ProductMasterSource,
  contributedByUserId: product.contributedByUserId,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

const resolveStatus = (item: PrismaInventoryItem) => {
  if (
    item.status === ItemStatus.ACTIVE &&
    calculateDaysLeftUntilExpiry(item.expiryDate) < 0
  ) {
    return ItemStatus.EXPIRED;
  }

  return item.status as ItemStatus;
};

export const serializeInventoryItem = (
  item: PrismaInventoryItem,
): InventoryItem => ({
  id: item.id,
  productId: item.productId,
  ownerKey: item.ownerKey,
  spaceId: item.spaceId,
  createdByUserId: item.createdByUserId,
  updatedByUserId: item.updatedByUserId,
  version: item.version,
  displayName: item.displayName,
  brand: item.brand,
  category: item.category ? (item.category as ProductCategory) : null,
  quantity: item.quantity,
  unit: item.unit,
  quantityBase: item.quantityBase,
  unitCode: item.unitCode as UnitCode,
  storageLocation: item.storageLocation,
  expiryDate: toKstDateOnly(item.expiryDate),
  expirySource: item.expirySource as ExpirySource,
  status: resolveStatus(item),
  notes: item.notes,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

/** Admin list/summary views: drop free-text notes and mask owner ids. */
export const serializeAdminInventoryItem = (
  item: PrismaInventoryItem,
): InventoryItem => {
  const serialized = serializeInventoryItem(item);

  return {
    ...serialized,
    ownerKey: maskOwnerKey(serialized.ownerKey ?? item.ownerKey),
    notes: null,
  };
};

export function maskOwnerKey(ownerKey: string) {
  return createHash("sha256").update(ownerKey).digest("hex").slice(0, 12);
}

export const serializeNotificationPreference = (
  preference: PrismaNotificationPreference,
): NotificationPreference => ({
  id: preference.id,
  ownerKey: preference.ownerKey,
  enabled: preference.enabled,
  reminderDaysBefore: preference.reminderDaysBefore,
  remindOnDayOf: preference.remindOnDayOf,
  quietHoursStart: preference.quietHoursStart,
  quietHoursEnd: preference.quietHoursEnd,
  updatedAt: preference.updatedAt.toISOString(),
});

export const serializeUserStorageLocation = (
  location: PrismaUserStorageLocation,
): UserStorageLocation => ({
  id: location.id,
  ownerKey: location.ownerKey,
  spaceId: location.spaceId,
  key: location.key,
  label: location.label,
  sortOrder: location.sortOrder,
  createdAt: location.createdAt.toISOString(),
  updatedAt: location.updatedAt.toISOString(),
});

export const serializePushToken = (pushToken: PrismaPushToken): PushToken => ({
  id: pushToken.id,
  ownerKey: pushToken.ownerKey,
  token: pushToken.token,
  platform: pushToken.platform as PushTokenPlatform,
  deviceId: pushToken.deviceId,
  appVersion: pushToken.appVersion,
  enabled: pushToken.enabled,
  lastSeenAt: pushToken.lastSeenAt.toISOString(),
  updatedAt: pushToken.updatedAt.toISOString(),
});
