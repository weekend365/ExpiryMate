import type { ProductSubscription } from "expo-iap";
import {
  APPLE_MONTHLY_SUBSCRIPTION_ID,
  APPLE_YEARLY_SUBSCRIPTION_ID,
  GOOGLE_SUBSCRIPTION_ID,
} from "../monetization/iap-products";

export type BillingPeriod = "monthly" | "yearly";
export type StorePlan = {
  period: BillingPeriod;
  displayPrice: string;
  price: number | null;
  productId: string;
  offerToken?: string;
};

export function resolvePlans(products: ProductSubscription[], platform: string): StorePlan[] {
  if (platform === "ios") {
    return products.flatMap((product) => {
      if (product.platform !== "ios") return [];
      const period =
        product.id === APPLE_YEARLY_SUBSCRIPTION_ID
          ? "yearly"
          : product.id === APPLE_MONTHLY_SUBSCRIPTION_ID
            ? "monthly"
            : null;
      return period
        ? [
            {
              period,
              displayPrice: product.displayPrice,
              price: product.price ?? null,
              productId: product.id,
            },
          ]
        : [];
    });
  }

  const product = products.find(
    (item) => item.platform === "android" && item.id === GOOGLE_SUBSCRIPTION_ID,
  );
  if (!product || product.platform !== "android") return [];
  return product.subscriptionOffers.flatMap((offer) => {
    const period =
      offer.basePlanIdAndroid === "yearly"
        ? "yearly"
        : offer.basePlanIdAndroid === "monthly"
          ? "monthly"
          : null;
    return period
      ? [
          {
            period,
            displayPrice: offer.displayPrice,
            price: offer.price,
            productId: product.id,
            offerToken: offer.offerTokenAndroid ?? undefined,
          },
        ]
      : [];
  });
}

export function getAnnualSavings(plans: StorePlan[]) {
  const monthly = plans.find((plan) => plan.period === "monthly")?.price;
  const yearly = plans.find((plan) => plan.period === "yearly")?.price;
  if (!monthly || !yearly || monthly <= 0) return null;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}
