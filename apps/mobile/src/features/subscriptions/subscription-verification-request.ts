import type { SubscriptionVerificationRequest } from "@expirymate/shared";
import type { Purchase } from "expo-iap";

type StorePurchase = Pick<
  Purchase,
  "productId" | "transactionId" | "purchaseToken" | "currentPlanId"
>;

export function buildSubscriptionVerificationRequest(
  store: SubscriptionVerificationRequest["store"],
  purchase: StorePurchase,
  purchaseIntentId?: string,
): SubscriptionVerificationRequest {
  if (store === "apple_app_store") {
    return {
      store,
      productId: purchase.productId,
      transactionId: purchase.transactionId ?? undefined,
      purchaseIntentId,
    };
  }

  // Android Purchase does not contain an authoritative base plan. The IAP
  // wrapper can report the first offer's plan for a different purchase, and
  // the currently selected UI period also says nothing about restored items.
  // The API resolves the billing period from Google's verified line item.
  return {
    store,
    productId: purchase.productId,
    purchaseToken: purchase.purchaseToken ?? undefined,
    purchaseIntentId,
  };
}
