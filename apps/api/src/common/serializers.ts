import {
  type InventoryItem as PrismaInventoryItem,
  type NotificationPreference as PrismaNotificationPreference,
  type Product as PrismaProduct,
  type PushToken as PrismaPushToken,
} from "@prisma/client";
import {
  calculateDaysLeftUntilExpiry,
  ExpirySource,
  type InventoryItem,
  ItemStatus,
  type NotificationPreference,
  type Product,
  ProductCategory,
  type PushToken,
  type PushTokenPlatform,
  StorageLocation,
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
  displayName: item.displayName,
  brand: item.brand,
  category: item.category ? (item.category as ProductCategory) : null,
  quantity: item.quantity,
  unit: item.unit,
  storageLocation: item.storageLocation as StorageLocation,
  expiryDate: item.expiryDate.toISOString(),
  expirySource: item.expirySource as ExpirySource,
  status: resolveStatus(item),
  notes: item.notes,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

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
