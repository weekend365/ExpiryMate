/** Shared field length ceilings for API/mobile write contracts (P2-01). */
export const fieldLimits = {
  productId: 64,
  displayName: 120,
  brand: 80,
  unit: 32,
  notes: 500,
  storageLocationKey: 32,
  storageLocationLabel: 20,
  inventorySpaceName: 40,
  barcode: { min: 8, max: 18 },
  pushToken: 512,
  deviceId: 128,
  appVersion: 64,
  subscriptionProductId: 128,
  subscriptionTransactionId: 256,
  subscriptionPurchaseToken: 4096,
  recipeIngredientName: 120,
  recipeText: 2000,
  supportInquiryBody: { min: 10, max: 2000 },
} as const;

/** Max custom storage locations per owner. */
export const MAX_CUSTOM_STORAGE_LOCATIONS = 10;
