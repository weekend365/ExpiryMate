import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SubscriptionPurchaseIntent } from "@expirymate/shared";
import type { Purchase } from "expo-iap";

export const APPLE_MONTHLY_SUBSCRIPTION_ID = "expirymate_premium_monthly";
export const APPLE_YEARLY_SUBSCRIPTION_ID = "expirymate_premium_yearly";
export const GOOGLE_SUBSCRIPTION_ID = "jango_plus";
export const ANDROID_PACKAGE_NAME = "com.expirymate.mobile";

const PERSONAL_SUBSCRIPTION_IDS = new Set([
  APPLE_MONTHLY_SUBSCRIPTION_ID,
  APPLE_YEARLY_SUBSCRIPTION_ID,
  GOOGLE_SUBSCRIPTION_ID,
]);
const PENDING_INTENT_STORAGE_KEY = "expirymate.pendingPlusPurchaseIntent.v1";

export function isPersonalSubscriptionProduct(productId: string) {
  return PERSONAL_SUBSCRIPTION_IDS.has(productId);
}

export async function readPendingSubscriptionPurchaseIntent(productId: string) {
  const stored = await AsyncStorage.getItem(PENDING_INTENT_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<SubscriptionPurchaseIntent>;
    return parsed.productId === productId && typeof parsed.id === "string"
      ? (parsed as SubscriptionPurchaseIntent)
      : null;
  } catch {
    return null;
  }
}

export function savePendingSubscriptionPurchaseIntent(
  intent: SubscriptionPurchaseIntent,
) {
  return AsyncStorage.setItem(PENDING_INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function clearPendingSubscriptionPurchaseIntent() {
  return AsyncStorage.removeItem(PENDING_INTENT_STORAGE_KEY);
}

export function purchaseKey(purchase: Purchase) {
  return [
    purchase.store,
    purchase.productId,
    purchase.purchaseToken ?? purchase.transactionId ?? purchase.id,
  ].join(":");
}

export function mergePurchaseByKey(current: Purchase[], purchase: Purchase) {
  const key = purchaseKey(purchase);
  const existingIndex = current.findIndex(
    (candidate) => purchaseKey(candidate) === key,
  );
  if (existingIndex === -1) {
    return [...current, purchase];
  }
  if (current[existingIndex] === purchase) {
    return current;
  }

  const next = [...current];
  next[existingIndex] = purchase;
  return next;
}
