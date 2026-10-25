import type {
  SubscriptionPurchaseIntent,
} from "@expirymate/shared";
import type { Purchase } from "expo-iap";
import {
  deepLinkToSubscriptions,
  getAvailablePurchases,
} from "expo-iap";
import { router } from "expo-router";
import {
  CreditCard,
  RefreshCw,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { ListRow } from "../../src/components/ListRow";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { IapUnavailableState } from "../../src/features/monetization/IapUnavailableState";
import {
  isIapRuntimeAvailable,
} from "../../src/features/monetization/iap-runtime";
import { useIapStore } from "../../src/features/monetization/iap-purchase-provider";
import {
  ANDROID_PACKAGE_NAME,
  GOOGLE_SUBSCRIPTION_ID,
  clearPendingSubscriptionPurchaseIntent,
  isPersonalSubscriptionProduct,
  purchaseKey,
  readPendingSubscriptionPurchaseIntent,
  savePendingSubscriptionPurchaseIntent,
} from "../../src/features/monetization/iap-products";
import { useSubscriptionProducts } from "../../src/features/subscriptions/use-subscription-products";
import { SubscriptionProductsNotice } from "../../src/features/subscriptions/subscription-products-notice";
import { getAnnualSavings, type BillingPeriod } from "../../src/features/subscriptions/subscription-plans";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import {
  formatSubscriptionExpiry,
  formatSubscriptionStore,
} from "../../src/features/settings/settings-format";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { getSubscriptionScreenState } from "../../src/features/subscriptions/subscription-screen-state";
import { buildSubscriptionVerificationRequest } from "../../src/features/subscriptions/subscription-verification-request";
import { SubscriptionSalesNotice, SubscriptionStatusSection } from "../../src/features/subscriptions/subscription-status";
import { publicWebUrl } from "../../src/shared/public-web-url";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { colors, radius, spacing } from "../../src/shared/theme";
import {
  ApiError,
  createSubscriptionPurchaseIntent,
  trackMonetizationEvent,
} from "../../src/services/api";

export default function SubscriptionSettingsScreen() {
  if (!isIapRuntimeAvailable()) {
    return <IapUnavailableState feature="장고 플러스 구독" />;
  }

  return <SubscriptionStoreScreen />;
}

function SubscriptionStoreScreen() {
  const { shouldStack } = useResponsiveLayout();
  const subscription = useSubscriptionEntitlement();
  const monetization = useMonetization();
  const entitlement = subscription.query.data;
  const hasActiveEntitlement = Boolean(entitlement?.hasActiveEntitlement);
  const screenState = getSubscriptionScreenState({
    entitlement: subscription.query,
    sales: {
      data: monetization.access?.subscriptionsEnabled,
      isError: monetization.isError,
      isFetching: monetization.isFetching,
    },
  });
  const [selectedPeriod, setSelectedPeriod] =
    useState<BillingPeriod>("monthly");
  const [busyAction, setBusyAction] = useState<"purchase" | "restore" | null>(
    null,
  );
  const busyActionRef = useRef<"purchase" | "restore" | null>(null);
  const restoreEventsRef = useRef(new Map<string, Purchase>());
  const restoreStoreErrorsRef = useRef<unknown[]>([]);
  const processingPurchasesRef = useRef(new Set<string>());
  const trackedPaywallRef = useRef(false);
  const purchaseCompletedRef = useRef(false);
  const purchasePendingNoticeShownRef = useRef(false);
  const purchaseIntentRef = useRef<SubscriptionPurchaseIntent | null>(null);

  function updateBusyAction(action: "purchase" | "restore" | null) {
    busyActionRef.current = action;
    setBusyAction(action);
  }

  async function readPurchaseIntent(productId: string) {
    if (purchaseIntentRef.current?.productId === productId) {
      return purchaseIntentRef.current;
    }
    return readPendingSubscriptionPurchaseIntent(productId);
  }

  async function clearPurchaseIntent() {
    purchaseIntentRef.current = null;
    await clearPendingSubscriptionPurchaseIntent();
  }

  function showPendingPurchaseNoticeOnce() {
    if (purchasePendingNoticeShownRef.current) return;
    purchasePendingNoticeShownRef.current = true;
    showPendingNotice();
  }

  async function handleStorePurchase(
    purchase: Purchase,
    options?: { restore?: boolean; onVerificationError?: (error: unknown) => void },
  ) {
    if (purchase.purchaseState === "pending") {
      if (!options?.restore) {
        updateBusyAction(null);
        showPendingPurchaseNoticeOnce();
      }
      return false;
    }

    const key = subscriptionTransactionKey(purchase);
    if (processingPurchasesRef.current.has(key)) return false;
    processingPurchasesRef.current.add(key);
    try {
      const purchaseIntent = options?.restore
        ? null
        : await readPurchaseIntent(purchase.productId);
      const verification = buildSubscriptionVerificationRequest(
        Platform.OS === "ios" ? "apple_app_store" : "google_play",
        purchase,
        purchaseIntent?.id,
      );
      const verified = await subscription.verifyMutation.mutateAsync(verification);
      await finishTransaction({ purchase, isConsumable: false });
      await clearPurchaseIntent();
      purchaseCompletedRef.current = true;
      trackFunnelEvent("purchase_verified", {
        store: Platform.OS,
        product_id: purchase.productId,
        billing_period: verified.entitlement.billingPeriod ?? "unknown",
      });
      if (!options?.restore) {
        updateBusyAction(null);
        showPurchaseSuccessNotice();
      }
      return true;
    } catch (error) {
      options?.onVerificationError?.(error);
      trackFunnelEvent("checkout_failed", {
        stage: "verification",
        reason: error instanceof Error ? error.name : "unknown",
      });
      // The restore action reports failed verification once after its batch.
      if (!options?.restore) {
        updateBusyAction(null);
        Alert.alert("구독을 확인하지 못했어요", getErrorMessage(error));
      }
      return false;
    } finally {
      processingPurchasesRef.current.delete(key);
    }
  }

  const {
    connected,
    reconnect,
    requestPurchase,
    finishTransaction,
  } = useIapStore({
    // Unsolicited replay belongs to the root provider's silent recovery.
    handlesPurchase: (productId) =>
      isPersonalSubscriptionProduct(productId) && busyActionRef.current !== null,
    onPurchaseSuccess: (purchase) => {
      if (!isPersonalSubscriptionProduct(purchase.productId)) return;
      if (busyActionRef.current === "restore") {
        restoreEventsRef.current.set(subscriptionTransactionKey(purchase), purchase);
      } else if (busyActionRef.current === "purchase") {
        void handleStorePurchase(purchase);
      }
    },
    onPurchaseError: (error) => {
      if (busyActionRef.current === "restore") {
        restoreStoreErrorsRef.current.push(new Error(error.message));
        return;
      }
      updateBusyAction(null);
      if (getPurchasePendingCode(error)) {
        showPendingPurchaseNoticeOnce();
        return;
      }
      const cancelled = getPurchaseCancellationCode(error) !== null;
      trackFunnelEvent(cancelled ? "checkout_cancelled" : "checkout_failed", {
        reason: String(error.code),
      });
      if (cancelled) return;
      Alert.alert("결제를 완료하지 못했어요", error.message);
    },
    onError: (error) => {
      if (busyActionRef.current === "restore") {
        restoreStoreErrorsRef.current.push(error);
        return;
      }
      updateBusyAction(null);
      trackFunnelEvent("checkout_failed", {
        stage: "store_connection",
        reason: error.name,
      });
      // Product loading failures are shown inline with a retry action.
    },
  });

  const productsQuery = useSubscriptionProducts({
    connected,
    reconnect,
    enabled: screenState.sales === "available",
  });
  const plans = productsQuery.isError ? [] : productsQuery.data ?? [];
  const pricesLoading = productsQuery.isFetching || productsQuery.isPending;

  useEffect(() => {
    if (
      trackedPaywallRef.current ||
      subscription.query.isLoading ||
      hasActiveEntitlement ||
      !monetization.access
    ) {
      return;
    }
    trackedPaywallRef.current = true;
    trackFunnelEvent("paywall_viewed", { variant: "personal-plus-launch" });
  }, [hasActiveEntitlement, monetization.access, subscription.query.isLoading]);

  useEffect(
    () => () => {
      if (trackedPaywallRef.current && !purchaseCompletedRef.current) {
        trackFunnelEvent("paywall_dismissed", { plan_code: "jango_plus" });
      }
    },
    [],
  );

  const selectedPlan = plans.find((plan) => plan.period === selectedPeriod);
  const annualSavings = getAnnualSavings(plans);

  const startPurchase = async () => {
    if (busyActionRef.current !== null) return;
    if (!connected || productsQuery.isFetching || !selectedPlan) {
      Alert.alert(
        "가격을 불러오는 중이에요",
        "스토어 연결을 확인한 뒤 잠시 후 다시 눌러 주세요.",
      );
      return;
    }
    purchasePendingNoticeShownRef.current = false;
    updateBusyAction("purchase");
    trackFunnelEvent("checkout_started", {
      billing_period: selectedPlan.period,
      product_id: selectedPlan.productId,
      plan_code: "jango_plus",
    });
    try {
      const intent = await createSubscriptionPurchaseIntent({
        store: Platform.OS === "ios" ? "apple_app_store" : "google_play",
        productId: selectedPlan.productId,
      });
      purchaseIntentRef.current = intent;
      await savePendingSubscriptionPurchaseIntent(intent);
      await requestPurchase({
        type: "subs",
        request:
          Platform.OS === "ios"
            ? {
                apple: {
                  sku: selectedPlan.productId,
                  appAccountToken: intent.appleAppAccountToken,
                },
              }
            : {
                google: {
                  skus: [selectedPlan.productId],
                  obfuscatedAccountId: intent.googleObfuscatedAccountId,
                  subscriptionOffers: selectedPlan.offerToken
                    ? [
                        {
                          sku: selectedPlan.productId,
                          offerToken: selectedPlan.offerToken,
                        },
                      ]
                    : undefined,
                },
              },
      });
    } catch (error) {
      updateBusyAction(null);
      if (getPurchasePendingCode(error)) {
        showPendingPurchaseNoticeOnce();
        return;
      }
      const cancellationCode = getPurchaseCancellationCode(error);
      trackFunnelEvent(cancellationCode ? "checkout_cancelled" : "checkout_failed", {
        stage: "request_purchase",
        reason: cancellationCode ?? (error instanceof Error ? error.name : "unknown"),
      });
      if (cancellationCode) return;
      Alert.alert("결제를 시작하지 못했어요", getErrorMessage(error));
    }
  };

  const restore = async () => {
    if (busyActionRef.current !== null) return;
    updateBusyAction("restore");
    restoreEventsRef.current.clear();
    restoreStoreErrorsRef.current = [];
    trackFunnelEvent("restore_started");
    try {
      const restoreErrors: unknown[] = [];
      try {
        const purchases = await getAvailablePurchases({
          onlyIncludeActiveItemsIOS: true,
          alsoPublishToEventListenerIOS: false,
        });
        for (const purchase of purchases) {
          if (isPersonalSubscriptionProduct(purchase.productId)) {
            restoreEventsRef.current.set(subscriptionTransactionKey(purchase), purchase);
          }
        }
      } catch (error) {
        if (!restoreEventsRef.current.size) throw error;
        restoreErrors.push(error);
      }
      let restoredCount = 0;
      let hasPendingPurchase = false;
      const processedKeys = new Set<string>();
      // StoreKit updates can overlap both the query and server verification.
      // Drain them into the same batch, with one verification per transaction.
      for (;;) {
        const next = [...restoreEventsRef.current].find(([key]) => !processedKeys.has(key));
        if (!next) break;
        const [key, purchase] = next;
        processedKeys.add(key);
        if (purchase.purchaseState === "pending") {
          hasPendingPurchase = true;
          continue;
        }
        if (await handleStorePurchase(purchase, {
          restore: true,
          onVerificationError: (error) => restoreErrors.push(error),
        })) {
          restoredCount += 1;
        }
      }
      restoreErrors.push(...restoreStoreErrorsRef.current);
      if (!processedKeys.size && !restoreErrors.length) {
        Alert.alert(
          "복원할 개인 구독이 없어요",
          "현재 스토어 계정을 확인해 주세요.",
        );
        return;
      }
      trackFunnelEvent(
        restoredCount > 0 ? "restore_completed" : "restore_failed",
        restoredCount > 0
          ? { purchase_count: String(restoredCount) }
          : { reason: "no_verified_purchase" },
      );
      if (restoredCount > 0) {
        showPurchaseSuccessNotice();
      } else if (hasPendingPurchase && !restoreErrors.length) {
        showPendingNotice();
      } else {
        const isOwnershipRejection = (error: unknown) =>
          error instanceof ApiError && error.status === 409;
        if (restoreErrors.length > 0 && restoreErrors.every(isOwnershipRejection)) {
          Alert.alert(
            "구독을 연결하지 못했어요",
            "다른 장고 계정에 연결된 구매는 자동으로 옮기지 않아요. 도움이 필요하면 설정의 고객지원으로 문의해 주세요.",
          );
        } else {
          Alert.alert(
            "구매를 복원하지 못했어요",
            getErrorMessage(restoreErrors.find(error => !isOwnershipRejection(error))),
          );
        }
      }
    } catch (error) {
      trackFunnelEvent("restore_failed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
      Alert.alert("구매를 복원하지 못했어요", getErrorMessage(error));
    } finally {
      restoreEventsRef.current.clear();
      restoreStoreErrorsRef.current = [];
      updateBusyAction(null);
    }
  };

  const manage = () =>
    deepLinkToSubscriptions({
      skuAndroid: GOOGLE_SUBSCRIPTION_ID,
      packageNameAndroid: ANDROID_PACKAGE_NAME,
    }).catch((error) =>
      Alert.alert("구독 관리를 열지 못했어요", getErrorMessage(error)),
    );

  return (
    <SettingsScreen backgroundTreatment="reading">
      <SubscriptionStatusSection
        state={screenState}
        activeDescription={`${formatSubscriptionStore(entitlement?.store)} · ${formatSubscriptionExpiry(entitlement?.expiresAt)}까지`}
        isRetrying={subscription.query.isFetching}
        onRetry={() => { void subscription.query.refetch(); }}
        onOpenInsights={() => router.push("/insights")}
      />

      <SettingsGroup
        title="냉장고를 덜 버리는 습관"
        content="plain"
      >
        <View style={styles.benefitCard}>
          <MascotSpeechBubble
            message="필요한 도움인지 함께 살펴봐요. 이용 횟수와 요금도 확인해 주세요."
            mood="point"
            size="small"
            layout="adaptive"
          />
          <BenefitLine text="30·90일 소비·폐기 추세, 폐기율, 주간 비교" />
          <BenefitLine text="임박 재료와 자주 버린 분류를 바탕으로 한 실천 제안" />
          <BenefitLine text="요리 추천 월 60회 · 하루 최대 5회" />
          <BenefitLine text="사진 일괄 등록 월 30회 · 하루 최대 3회" />
          <BenefitLine text="요리와 사진 흐름에서 보상 광고 없이 사용" />
        </View>
      </SettingsGroup>

      {screenState.sales === "available" ? (
        <SettingsGroup
          title="이용권 고르기"
          description="무료 체험 없이 선택한 기간마다 자동 갱신돼요."
          content="plain"
        >
          <SubscriptionProductsNotice
            plans={plans}
            loading={pricesLoading}
            failed={productsQuery.isError}
            onRetry={() => { void productsQuery.refetch(); }}
          />
          <View style={styles.planList}>
            {(["monthly", "yearly"] as const).map((period) => {
              const plan = plans.find((item) => item.period === period);
              const selected = selectedPeriod === period;
              return (
                <Pressable
                  key={period}
                  onPress={() => {
                    setSelectedPeriod(period);
                    trackFunnelEvent("plan_selected", {
                      billing_period: period,
                      plan_code: "jango_plus",
                    });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !plan || productsQuery.isFetching }}
                  disabled={!plan || productsQuery.isFetching}
                  style={[
                    styles.planCard,
                    shouldStack && styles.planCardStacked,
                    selected && styles.planCardSelected,
                  ]}
                >
                  <View style={styles.planCopy}>
                    <AppText variant="bodyStrong">
                      {period === "monthly" ? "월간" : "연간"}
                    </AppText>
                    <AppText variant="caption" tone="subtext">
                      {period === "yearly" && annualSavings
                        ? `월간 결제 대비 약 ${annualSavings}% 절약`
                        : period === "yearly" ? "매년 자동 갱신" : "매월 자동 갱신"}
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" tone="primary">
                    {plan?.displayPrice ?? (pricesLoading ? "가격 확인 중" : "현재 이용 불가")}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.renewalNotice}>
            <AppText variant="bodySmallStrong">결제 전에 알아두세요</AppText>
            <AppText variant="caption" tone="subtext">
              무료 체험은 없습니다. 선택한 월간 또는 연간 기간이 끝나면 위에 표시된
              스토어 가격으로 자동 갱신됩니다. 갱신 전 App Store 또는 Google Play의
              구독 관리에서 언제든 해지할 수 있고, 해지해도 만료일까지 혜택이
              유지됩니다. 구독하지 않아도 무료 기능과 기존 데이터는 계속 이용할 수
              있습니다.
            </AppText>
          </View>
          <Button
            onPress={() => void startPurchase()}
            loading={busyAction === "purchase"}
            disabled={!connected || productsQuery.isFetching || busyAction !== null || !selectedPlan}
            fullWidth
          >
            {!selectedPlan
              ? pricesLoading ? "가격을 확인하고 있어요" : "지금은 구독할 수 없어요"
              : selectedPeriod === "monthly"
              ? "월간으로 시작하기"
              : "연간으로 시작하기"}
          </Button>
        </SettingsGroup>
      ) : (
        <SubscriptionSalesNotice
          sales={screenState.sales}
          onRetry={() => { void monetization.refresh().catch(() => undefined); }}
        />
      )}

      <SettingsGroup title="스토어에서 관리하기">
        <ListRow
          title="구매 복원"
          description="같은 스토어 계정의 개인 플러스 구독만 다시 연결해요."
          icon={RefreshCw}
          onPress={() => void restore()}
        />
        <ListRow
          title="구독 관리"
          description="갱신, 해지, 결제 수단은 스토어에서 관리해요."
          icon={CreditCard}
          onPress={() => void manage()}
          last
        />
      </SettingsGroup>

      <SettingsGroup title="약관과 개인정보">
        <ListRow
          title="이용약관"
          icon={ShieldCheck}
          onPress={() => void Linking.openURL(publicWebUrl("/terms"))}
        />
        <ListRow
          title="개인정보처리방침"
          icon={ShieldCheck}
          onPress={() => void Linking.openURL(publicWebUrl("/privacy"))}
          last
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

function getPurchaseCancellationCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" && error.code.toLowerCase().includes("cancel")
    ? error.code
    : null;
}

function getPurchasePendingCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return null;
  const code = error.code.toLowerCase().replace(/^e_/, "").replaceAll("_", "-");
  return code === "deferred-payment" || code === "pending" ? error.code : null;
}

function subscriptionTransactionKey(purchase: Purchase) {
  const transactionId = Platform.OS === "ios" ? purchase.transactionId ?? purchase.id : null;
  return transactionId
    ? [purchase.store, purchase.productId, transactionId].join(":")
    : purchaseKey(purchase);
}

function showPurchaseSuccessNotice() {
  Alert.alert(
    "장고 플러스가 시작됐어요",
    "주간 브리핑과 30·90일 리포트를 보고, 광고 없이 요리와 사진 기능을 이용할 수 있어요.",
  );
}

function showPendingNotice() {
  Alert.alert(
    "결제가 확인 중이에요",
    "스토어 승인이 끝나면 앱을 다시 열었을 때 장고 플러스가 반영돼요.",
  );
}

function BenefitLine({ text }: { text: string }) {
  return (
    <View style={styles.benefitLine}>
      <AppText variant="bodyStrong" tone="primary">
        ✓
      </AppText>
      <AppText variant="bodySmall" style={styles.benefitText}>
        {text}
      </AppText>
    </View>
  );
}

function trackFunnelEvent(
  event: Parameters<typeof trackMonetizationEvent>[0]["event"],
  properties?: Record<string, string>,
) {
  void trackMonetizationEvent({ event, properties }).catch(() => undefined);
}

const styles = StyleSheet.create({
  benefitCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
  },
  benefitLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  benefitText: { flex: 1 },
  planList: { gap: spacing.sm },
  planCard: {
    minHeight: spacing.xxxl + spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  planCardSelected: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
  },
  planCardStacked: { flexDirection: "column", alignItems: "stretch" },
  planCopy: { flex: 1, gap: spacing.xxs },
  renewalNotice: {
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
