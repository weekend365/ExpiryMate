import type { Purchase } from "expo-iap";
import { useIAP, type UseIAPOptions } from "expo-iap";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys } from "../auth/session-boundary";
import {
  verifyRecommendationCreditPurchase,
  verifySubscription,
} from "../../services/api";
import { captureStartupBootstrapIssue } from "../../services/sentry";
import { isIapRuntimeAvailable } from "./iap-runtime";
import { useMonetization } from "./monetization-provider";
import {
  clearPendingSubscriptionPurchaseIntent,
  isPersonalSubscriptionProduct,
  mergePurchaseByKey,
  purchaseKey,
  readPendingSubscriptionPurchaseIntent,
} from "./iap-products";

type IapStore = ReturnType<typeof useIAP>;
type PurchaseSubscriber = Pick<
  UseIAPOptions,
  "onPurchaseSuccess" | "onPurchaseError" | "onError"
> & {
  handlesPurchase: (productId: string) => boolean;
};
type IapContextValue = {
  store: IapStore;
  subscribe: (subscriber: PurchaseSubscriber) => () => void;
};

const IapContext = createContext<IapContextValue | null>(null);

export function IapPurchaseProvider({ children }: PropsWithChildren) {
  if (!isIapRuntimeAvailable()) {
    return <>{children}</>;
  }
  return <NativeIapPurchaseProvider>{children}</NativeIapPurchaseProvider>;
}

function NativeIapPurchaseProvider({ children }: PropsWithChildren) {
  const subscribersRef = useRef<PurchaseSubscriber[]>([]);
  const [unclaimedPurchases, setUnclaimedPurchases] = useState<Purchase[]>([]);
  const [restoredForUserId, setRestoredForUserId] = useState<string | null>(null);
  const processingRef = useRef(new Set<string>());
  const { isRegistered, sessionUserId } = useAuth();
  const monetization = useMonetization();
  const queryClient = useQueryClient();

  const findSubscriber = useCallback((productId: string) => {
    return [...subscribersRef.current]
      .reverse()
      .find((subscriber) => subscriber.handlesPurchase(productId));
  }, []);

  const store = useIAP({
    onPurchaseSuccess: (purchase) => {
      const subscriber = findSubscriber(purchase.productId);
      if (subscriber?.onPurchaseSuccess) {
        subscriber.onPurchaseSuccess(purchase);
        return;
      }
      setUnclaimedPurchases((current) => mergePurchaseByKey(current, purchase));
    },
    onPurchaseError: (error) => {
      const subscriber = subscribersRef.current.at(-1);
      if (subscriber?.onPurchaseError) {
        subscriber.onPurchaseError(error);
        return;
      }
      captureStartupBootstrapIssue("iap.purchase-listener", error);
    },
    onError: (error) => {
      const subscriber = subscribersRef.current.at(-1);
      if (subscriber?.onError) {
        subscriber.onError(error);
        return;
      }
      captureStartupBootstrapIssue("iap.connection", error);
    },
  });
  const {
    connected,
    availablePurchases,
    getAvailablePurchases,
    finishTransaction,
  } = store;
  const { access, refresh } = monetization;

  const subscribe = useCallback((subscriber: PurchaseSubscriber) => {
    subscribersRef.current.push(subscriber);
    return () => {
      subscribersRef.current = subscribersRef.current.filter(
        (candidate) => candidate !== subscriber,
      );
    };
  }, []);

  useEffect(() => {
    // Store transactions can outlive an app session; always re-query and
    // re-verify them against the newly authenticated owner.
    setUnclaimedPurchases([]);
    setRestoredForUserId(null);
    processingRef.current.clear();
  }, [sessionUserId]);

  useEffect(() => {
    if (!connected || !isRegistered || !sessionUserId) return;
    const recoveryUserId = sessionUserId;
    let cancelled = false;
    void getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
      alsoPublishToEventListenerIOS: false,
    })
      .then(() => {
        if (!cancelled) {
          setRestoredForUserId(recoveryUserId);
        }
      })
      .catch((error: unknown) => {
        captureStartupBootstrapIssue("iap.restore-available-purchases", error);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, getAvailablePurchases, isRegistered, sessionUserId]);

  useEffect(() => {
    if (
      !isRegistered ||
      !sessionUserId ||
      restoredForUserId !== sessionUserId ||
      availablePurchases.length === 0
    ) {
      return;
    }
    setUnclaimedPurchases((current) =>
      availablePurchases.reduce(mergePurchaseByKey, current),
    );
  }, [availablePurchases, isRegistered, restoredForUserId, sessionUserId]);

  useEffect(() => {
    if (!isRegistered || !access || unclaimedPurchases.length === 0) {
      return;
    }

    for (const purchase of unclaimedPurchases) {
      const key = purchaseKey(purchase);
      if (processingRef.current.has(key) || purchase.purchaseState === "pending") {
        continue;
      }
      const isSubscription = isPersonalSubscriptionProduct(purchase.productId);
      const isCredit = access.paidCredits.products.some(
        (product) => product.productId === purchase.productId,
      );
      if (!isSubscription && !isCredit) {
        continue;
      }

      processingRef.current.add(key);
      void recoverPurchase(purchase, isSubscription)
        .then(async () => {
          await finishTransaction({
            purchase,
            isConsumable: !isSubscription,
          });
          if (isSubscription) {
            await clearPendingSubscriptionPurchaseIntent().catch(() => undefined);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: sessionQueryKeys.subscription }),
              queryClient.invalidateQueries({ queryKey: sessionQueryKeys.monetization }),
            ]);
          } else {
            await refresh();
          }
          setUnclaimedPurchases((current) =>
            current.filter((candidate) => purchaseKey(candidate) !== key),
          );
        })
        .catch((error: unknown) => {
          captureStartupBootstrapIssue("iap.recover-purchase", error, {
            product_id_present: Boolean(purchase.productId),
            subscription: isSubscription,
          });
        })
        .finally(() => {
          processingRef.current.delete(key);
        });
    }
  }, [
    isRegistered,
    access,
    finishTransaction,
    queryClient,
    refresh,
    unclaimedPurchases,
  ]);

  const value = useMemo(() => ({ store, subscribe }), [store, subscribe]);
  return <IapContext.Provider value={value}>{children}</IapContext.Provider>;
}

export function useIapStore(subscriber: PurchaseSubscriber) {
  const value = useContext(IapContext);
  if (!value) {
    throw new Error("useIapStore requires an available IapPurchaseProvider");
  }

  useEffect(() => value.subscribe(subscriber), [subscriber, value]);
  return value.store;
}

async function recoverPurchase(purchase: Purchase, subscription: boolean) {
  if (subscription) {
    const intent = await readPendingSubscriptionPurchaseIntent(purchase.productId);
    return verifySubscription(
      Platform.OS === "ios"
        ? {
            store: "apple_app_store",
            productId: purchase.productId,
            transactionId: purchase.transactionId ?? undefined,
            purchaseIntentId: intent?.id,
          }
        : {
            store: "google_play",
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken ?? undefined,
            basePlanId: purchase.currentPlanId ?? undefined,
            purchaseIntentId: intent?.id,
          },
    );
  }

  return verifyRecommendationCreditPurchase(
    Platform.OS === "ios"
      ? {
          store: "apple_app_store",
          productId: purchase.productId,
          transactionId: purchase.transactionId ?? undefined,
        }
      : {
          store: "google_play",
          productId: purchase.productId,
          purchaseToken: purchase.purchaseToken ?? undefined,
        },
  );
}
