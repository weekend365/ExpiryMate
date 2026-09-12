import { queryOptions } from "@tanstack/react-query";
import type { StorePlan } from "./subscription-plans";

export const SUBSCRIPTION_PRODUCTS_TIMEOUT_MS = 15_000;

type StoreLoader = {
  connected: boolean;
  reconnect: () => Promise<boolean>;
  loadPlans: () => Promise<StorePlan[]>;
};

export function subscriptionProductsQueryOptions(platform: string, store: StoreLoader) {
  return queryOptions({
    queryKey: ["subscription-store-products", platform],
    queryFn: async () => {
      let expired = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("subscription-products-timeout"));
        }, SUBSCRIPTION_PRODUCTS_TIMEOUT_MS);
      });
      try {
        return await Promise.race([
          (async () => {
            if (!store.connected && !(await store.reconnect())) {
              throw new Error("subscription-store-disconnected");
            }
            // A late reconnect must not start another native product request.
            if (expired) throw new Error("subscription-products-timeout");
            return store.loadPlans();
          })(),
          timeout,
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    // StoreKit owns its network connection; do not leave this query paused
    // indefinitely by the HTTP client's offline state.
    networkMode: "always",
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}
