import { useQuery } from "@tanstack/react-query";
import { fetchProducts, type ProductSubscription } from "expo-iap";
import { Platform } from "react-native";
import {
  APPLE_MONTHLY_SUBSCRIPTION_ID,
  APPLE_YEARLY_SUBSCRIPTION_ID,
  GOOGLE_SUBSCRIPTION_ID,
} from "../monetization/iap-products";
import { resolvePlans } from "./subscription-plans";
import { subscriptionProductsQueryOptions } from "./subscription-products-query";

export function useSubscriptionProducts({ connected, reconnect, enabled }: {
  connected: boolean;
  reconnect: () => Promise<boolean>;
  enabled: boolean;
}) {
  return useQuery({
    ...subscriptionProductsQueryOptions(Platform.OS, {
      connected,
      reconnect,
      loadPlans: async () => {
        // Read this request's result directly: useIAP.subscriptions merges old
        // products, so it cannot distinguish an empty response from cached data.
        const products = await fetchProducts({
          skus: Platform.OS === "ios"
            ? [APPLE_MONTHLY_SUBSCRIPTION_ID, APPLE_YEARLY_SUBSCRIPTION_ID]
            : [GOOGLE_SUBSCRIPTION_ID],
          type: "subs",
        });
        return resolvePlans(
          (products ?? []).filter((product): product is ProductSubscription => product.type === "subs"),
          Platform.OS,
        );
      },
    }),
    enabled,
  });
}
