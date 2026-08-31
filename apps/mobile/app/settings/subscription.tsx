import type {
  SubscriptionPurchaseIntent,
  SubscriptionVerificationRequest,
} from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Purchase, ProductSubscription } from "expo-iap";
import {
  deepLinkToSubscriptions,
  getAvailablePurchases,
  useIAP,
} from "expo-iap";
import { router } from "expo-router";
import {
  CreditCard,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { IapUnavailableState } from "../../src/features/monetization/IapUnavailableState";
import {
  isIapRuntimeAvailable,
} from "../../src/features/monetization/iap-runtime";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import {
  formatSubscriptionExpiry,
  formatSubscriptionStore,
} from "../../src/features/settings/settings-format";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { publicWebUrl } from "../../src/shared/public-web-url";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { colors, radius, spacing } from "../../src/shared/theme";
import {
  createSubscriptionPurchaseIntent,
  trackMonetizationEvent,
} from "../../src/services/api";

const APPLE_MONTHLY_ID = "expirymate_premium_monthly";
const APPLE_YEARLY_ID = "expirymate_premium_yearly";
const GOOGLE_PRODUCT_ID = "jango_plus";
const PACKAGE_NAME = "com.expirymate.mobile";
const PENDING_INTENT_STORAGE_KEY = "expirymate.pendingPlusPurchaseIntent.v1";

type BillingPeriod = "monthly" | "yearly";
type StorePlan = {
  period: BillingPeriod;
  displayPrice: string;
  price: number | null;
  productId: string;
  offerToken?: string;
};

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
  const [selectedPeriod, setSelectedPeriod] =
    useState<BillingPeriod>("monthly");
  const [busyAction, setBusyAction] = useState<"purchase" | "restore" | null>(
    null,
  );
  const trackedPaywallRef = useRef(false);
  const purchaseCompletedRef = useRef(false);
  const purchaseIntentRef = useRef<SubscriptionPurchaseIntent | null>(null);

  async function readPurchaseIntent(productId: string) {
    if (purchaseIntentRef.current?.productId === productId) {
      return purchaseIntentRef.current;
    }
    const stored = await AsyncStorage.getItem(PENDING_INTENT_STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as SubscriptionPurchaseIntent;
      return parsed.productId === productId ? parsed : null;
    } catch {
      return null;
    }
  }

  async function clearPurchaseIntent() {
    purchaseIntentRef.current = null;
    await AsyncStorage.removeItem(PENDING_INTENT_STORAGE_KEY);
  }

  async function handleStorePurchase(
    purchase: Purchase,
    options?: { restore?: boolean },
  ) {
    if (purchase.purchaseState === "pending") {
      setBusyAction(null);
      Alert.alert(
        "결제가 확인 중이에요",
        "스토어 승인이 끝나면 앱을 다시 열었을 때 장고 플러스가 반영돼요.",
      );
      return false;
    }

    try {
      const purchaseIntent = options?.restore
        ? null
        : await readPurchaseIntent(purchase.productId);
      const verification: SubscriptionVerificationRequest =
        Platform.OS === "ios"
          ? {
              store: "apple_app_store",
              productId: purchase.productId,
              transactionId: purchase.transactionId ?? undefined,
              purchaseIntentId: purchaseIntent?.id,
            }
          : {
              store: "google_play",
              productId: purchase.productId,
              purchaseToken: purchase.purchaseToken ?? undefined,
              basePlanId: purchase.currentPlanId ?? selectedPeriod,
              purchaseIntentId: purchaseIntent?.id,
            };
      await subscription.verifyMutation.mutateAsync(verification);
      await finishTransaction({ purchase, isConsumable: false });
      await clearPurchaseIntent();
      purchaseCompletedRef.current = true;
      trackFunnelEvent("purchase_verified", {
        store: Platform.OS,
        product_id: purchase.productId,
        billing_period: purchase.currentPlanId ?? selectedPeriod,
      });
      setBusyAction(null);
      Alert.alert(
        "장고 플러스가 시작됐어요",
        "주간 브리핑과 30·90일 리포트를 보고, 광고 없이 요리와 사진 기능을 이용할 수 있어요.",
      );
      return true;
    } catch (error) {
      setBusyAction(null);
      trackFunnelEvent("checkout_failed", {
        stage: "verification",
        reason: error instanceof Error ? error.name : "unknown",
      });
      Alert.alert("구독을 확인하지 못했어요", getErrorMessage(error));
      return false;
    }
  }

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      if (isPersonalSubscriptionProduct(purchase.productId)) {
        void handleStorePurchase(purchase);
      }
    },
    onPurchaseError: (error) => {
      setBusyAction(null);
      const cancelled = String(error.code).toLowerCase().includes("cancel");
      trackFunnelEvent(cancelled ? "checkout_cancelled" : "checkout_failed", {
        reason: String(error.code),
      });
      if (cancelled) return;
      Alert.alert("결제를 완료하지 못했어요", error.message);
    },
    onError: (error) => {
      setBusyAction(null);
      trackFunnelEvent("checkout_failed", {
        stage: "store_connection",
        reason: error.name,
      });
      Alert.alert("스토어를 불러오지 못했어요", error.message);
    },
  });

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({
      skus:
        Platform.OS === "ios"
          ? [APPLE_MONTHLY_ID, APPLE_YEARLY_ID]
          : [GOOGLE_PRODUCT_ID],
      type: "subs",
    });
  }, [connected, fetchProducts]);

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

  const plans = useMemo(() => resolvePlans(subscriptions), [subscriptions]);
  const selectedPlan = plans.find((plan) => plan.period === selectedPeriod);
  const annualSavings = getAnnualSavings(plans);

  const startPurchase = async () => {
    if (!selectedPlan) {
      Alert.alert(
        "가격을 불러오는 중이에요",
        "스토어 연결을 확인한 뒤 잠시 후 다시 눌러 주세요.",
      );
      return;
    }
    setBusyAction("purchase");
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
      await AsyncStorage.setItem(
        PENDING_INTENT_STORAGE_KEY,
        JSON.stringify(intent),
      );
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
      setBusyAction(null);
      trackFunnelEvent("checkout_failed", {
        stage: "request_purchase",
        reason: error instanceof Error ? error.name : "unknown",
      });
      Alert.alert("결제를 시작하지 못했어요", getErrorMessage(error));
    }
  };

  const restore = async () => {
    setBusyAction("restore");
    trackFunnelEvent("restore_started");
    try {
      const purchases = (await getAvailablePurchases()).filter((purchase) =>
        isPersonalSubscriptionProduct(purchase.productId),
      );
      if (!purchases.length) {
        setBusyAction(null);
        Alert.alert(
          "복원할 개인 구독이 없어요",
          "현재 스토어 계정을 확인해 주세요.",
        );
        return;
      }
      let restoredCount = 0;
      for (const purchase of purchases) {
        if (await handleStorePurchase(purchase, { restore: true })) {
          restoredCount += 1;
        }
      }
      trackFunnelEvent(
        restoredCount > 0 ? "restore_completed" : "restore_failed",
        restoredCount > 0
          ? { purchase_count: String(restoredCount) }
          : { reason: "no_verified_purchase" },
      );
      if (restoredCount === 0) {
        Alert.alert(
          "구독을 연결하지 못했어요",
          "다른 장고 계정에 연결된 구매는 자동으로 옮기지 않아요. 도움이 필요하면 설정의 고객지원으로 문의해 주세요.",
        );
      }
    } catch (error) {
      setBusyAction(null);
      trackFunnelEvent("restore_failed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
      Alert.alert("구매를 복원하지 못했어요", getErrorMessage(error));
    }
  };

  const manage = () =>
    deepLinkToSubscriptions({
      skuAndroid: GOOGLE_PRODUCT_ID,
      packageNameAndroid: PACKAGE_NAME,
    }).catch((error) =>
      Alert.alert("구독 관리를 열지 못했어요", getErrorMessage(error)),
    );

  return (
    <SettingsScreen>
      <SettingsGroup title="지금 상태">
        <ListRow
          title={
            hasActiveEntitlement
              ? "장고 플러스를 이용 중이에요"
              : "무료 이용 중이에요"
          }
          description={
            subscription.query.isLoading
              ? "구독 상태를 불러오고 있어요."
              : hasActiveEntitlement
                ? `${formatSubscriptionStore(entitlement?.store)} · ${formatSubscriptionExpiry(entitlement?.expiresAt)}까지`
                : "재고·공유·기본 알림은 계속 무료로 이용할 수 있어요."
          }
          icon={CreditCard}
          last={!hasActiveEntitlement}
        />
        {hasActiveEntitlement ? (
          <ListRow
            title="폐기 예방 리포트 보기"
            description="30·90일 추세와 이번 주 실천 제안을 확인해요."
            icon={TrendingDown}
            onPress={() => router.push("/insights")}
            last
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title="냉장고를 덜 버리는 습관"
        description="AI 횟수만 늘리는 대신, 매주 실제로 덜 버릴 수 있는 흐름을 만들어요."
        content="plain"
      >
        <View style={styles.benefitCard}>
          <BenefitLine text="30·90일 소비·폐기 추세, 폐기율, 주간 비교" />
          <BenefitLine text="임박 재료와 자주 버린 분류를 바탕으로 한 실천 제안" />
          <BenefitLine text="요리 추천 월 60회 · 하루 최대 5회" />
          <BenefitLine text="사진 일괄 등록 월 30회 · 하루 최대 3회" />
          <BenefitLine text="요리와 사진 흐름에서 보상 광고 없이 사용" />
        </View>
      </SettingsGroup>

      {!hasActiveEntitlement && monetization.access?.subscriptionsEnabled ? (
        <SettingsGroup
          title="이용권 고르기"
          description="무료 체험 없이 선택한 기간마다 자동 갱신돼요."
          content="plain"
        >
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
                  accessibilityState={{ selected }}
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
                        : "매월 자동 갱신"}
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" tone="primary">
                    {plan?.displayPrice ?? "가격 확인 중"}
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
            disabled={!connected || busyAction !== null || !selectedPlan}
            fullWidth
          >
            {!selectedPlan
              ? "가격을 확인하고 있어요"
              : selectedPeriod === "monthly"
              ? "월간으로 시작하기"
              : "연간으로 시작하기"}
          </Button>
        </SettingsGroup>
      ) : !hasActiveEntitlement ? (
        <SettingsGroup
          title="지금은 신규 가입을 쉬고 있어요"
          description="원가 검증 또는 운영 점검 중에는 신규 판매만 닫고, 이미 결제한 혜택은 그대로 유지해요."
          content="plain"
        />
      ) : null}

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

function resolvePlans(products: ProductSubscription[]): StorePlan[] {
  if (Platform.OS === "ios") {
    return products.flatMap((product) => {
      if (product.platform !== "ios") return [];
      const period =
        product.id === APPLE_YEARLY_ID
          ? "yearly"
          : product.id === APPLE_MONTHLY_ID
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
    (item) => item.platform === "android" && item.id === GOOGLE_PRODUCT_ID,
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

function getAnnualSavings(plans: StorePlan[]) {
  const monthly = plans.find((plan) => plan.period === "monthly")?.price;
  const yearly = plans.find((plan) => plan.period === "yearly")?.price;
  if (!monthly || !yearly || monthly <= 0) return null;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

function isPersonalSubscriptionProduct(productId: string) {
  return [APPLE_MONTHLY_ID, APPLE_YEARLY_ID, GOOGLE_PRODUCT_ID].includes(
    productId,
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
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
