import type { Purchase, ProductSubscription } from "expo-iap";
import {
  deepLinkToSubscriptions,
  getAvailablePurchases,
  useIAP,
} from "expo-iap";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { ListRow } from "../../src/components/ListRow";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import {
  formatSubscriptionExpiry,
  formatSubscriptionStore,
} from "../../src/features/settings/settings-format";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { trackMonetizationEvent } from "../../src/services/api";
import { colors, radius, spacing, typography } from "../../src/shared/theme";

const APPLE_MONTHLY_ID = "expirymate_premium_monthly";
const APPLE_YEARLY_ID = "expirymate_premium_yearly";
const GOOGLE_PRODUCT_ID = "jango_plus";
const PACKAGE_NAME = "com.expirymate.mobile";

type BillingPeriod = "monthly" | "yearly";
type StorePlan = {
  period: BillingPeriod;
  displayPrice: string;
  price: number | null;
  productId: string;
  offerToken?: string;
};

export default function SubscriptionSettingsScreen() {
  const subscription = useSubscriptionEntitlement();
  const monetization = useMonetization();
  const entitlement = subscription.query.data;
  const hasActiveEntitlement = Boolean(entitlement?.hasActiveEntitlement);
  const [selectedPeriod, setSelectedPeriod] =
    useState<BillingPeriod>("yearly");
  const [busyAction, setBusyAction] = useState<
    "purchase" | "restore" | null
  >(null);
  const appliedExperimentRef = useRef(false);
  const trackedPaywallRef = useRef(false);

  async function handleStorePurchase(purchase: Purchase) {
    if (purchase.purchaseState === "pending") {
      setBusyAction(null);
      Alert.alert(
        "결제가 확인 중이에요",
        "스토어에서 결제가 완료되면 장고 플러스가 자동으로 반영돼요.",
      );
      return;
    }

    try {
      const verification =
        Platform.OS === "ios"
          ? {
              store: "apple_app_store" as const,
              productId: purchase.productId,
              transactionId: purchase.transactionId ?? undefined,
            }
          : {
              store: "google_play" as const,
              productId: purchase.productId,
              purchaseToken: purchase.purchaseToken ?? undefined,
              basePlanId: purchase.currentPlanId ?? selectedPeriod,
            };
      await subscription.verifyMutation.mutateAsync(verification);
      await finishTransaction({ purchase, isConsumable: false });
      trackFunnelEvent("purchase_verified", {
        store: Platform.OS,
        product_id: purchase.productId,
        billing_period: purchase.currentPlanId ?? selectedPeriod,
      });
      setBusyAction(null);
      Alert.alert(
        "장고 플러스가 시작됐어요",
        `오늘 총 ${monetization.access?.subscriberDailyLimit ?? 30}회까지 광고 없이 추천받을 수 있어요.`,
      );
      return true;
    } catch (error) {
      setBusyAction(null);
      trackFunnelEvent("checkout_failed", {
        stage: "verification",
        reason: error instanceof Error ? error.name : "unknown",
      });
      Alert.alert(
        "구독을 확인하지 못했어요",
        getErrorMessage(error),
      );
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
      void handleStorePurchase(purchase);
    },
    onPurchaseError: (error) => {
      setBusyAction(null);
      const cancelled = String(error.code).toLowerCase().includes("cancel");
      trackFunnelEvent(
        cancelled ? "checkout_cancelled" : "checkout_failed",
        { reason: String(error.code) },
      );
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
    if (appliedExperimentRef.current || !monetization.access) return;
    appliedExperimentRef.current = true;
    setSelectedPeriod(monetization.access.experiment.defaultBillingPeriod);
  }, [monetization.access]);

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
    trackFunnelEvent("paywall_viewed", {
      variant: monetization.access.experiment.variant,
    });
  }, [
    hasActiveEntitlement,
    monetization.access,
    subscription.query.isLoading,
  ]);

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
    });
    try {
      await requestPurchase({
        type: "subs",
        request:
          Platform.OS === "ios"
            ? { apple: { sku: selectedPlan.productId } }
            : {
                google: {
                  skus: [selectedPlan.productId],
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
      const purchases = await getAvailablePurchases();
      if (!purchases.length) {
        setBusyAction(null);
        Alert.alert("복원할 구독이 없어요", "현재 스토어 계정을 확인해 주세요.");
        return;
      }
      let restoredCount = 0;
      for (const purchase of purchases) {
        if (await handleStorePurchase(purchase)) {
          restoredCount += 1;
        }
      }
      trackFunnelEvent(
        restoredCount > 0 ? "restore_completed" : "restore_failed",
        restoredCount > 0
          ? { purchase_count: String(restoredCount) }
          : { reason: "no_verified_purchase" },
      );
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
    <Screen
      title="장고 플러스"
      subtitle={`광고 없이 하루 총 ${monetization.access?.subscriberDailyLimit ?? 30}회 추천받아요.`}
    >
      <View style={styles.section}>
        <SectionHeader
          title="지금 상태"
          description="구독 혜택은 결제 기간이 끝날 때까지 유지돼요."
        />
        <View style={styles.card}>
          <ListRow
            title={
              hasActiveEntitlement ? "장고 플러스를 이용 중이에요" : "무료 이용 중이에요"
            }
            description={
              subscription.query.isLoading
                ? "구독 상태를 불러오고 있어요."
                : hasActiveEntitlement
                  ? `${formatSubscriptionStore(entitlement?.store)} · ${formatSubscriptionExpiry(entitlement?.expiresAt)}까지`
                  : "무료 추천과 선택형 보상 광고를 이용할 수 있어요."
            }
            icon={CreditCard}
            last
          />
        </View>
      </View>

      {!hasActiveEntitlement ? (
        <View style={styles.section}>
          <SectionHeader
            title="이용권 고르기"
            description={
              monetization.access?.experiment.variant === "value_first"
                ? "부담이 적은 월간부터 시작하거나 연간으로 절약할 수 있어요."
                : "무료 체험 없이 선택한 기간마다 자동 갱신돼요."
            }
          />
          <View style={styles.planList}>
            {(["yearly", "monthly"] as const).map((period) => {
              const plan = plans.find((item) => item.period === period);
              const selected = selectedPeriod === period;
              return (
                <Pressable
                  key={period}
                  onPress={() => {
                    setSelectedPeriod(period);
                    trackFunnelEvent("plan_selected", {
                      billing_period: period,
                    });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.planCard,
                    selected && styles.planCardSelected,
                  ]}
                >
                  <View style={styles.planCopy}>
                    <Text style={styles.planTitle}>
                      {period === "yearly" ? "연간" : "월간"}
                    </Text>
                    <Text style={styles.planDescription}>
                      {period === "yearly" && annualSavings
                        ? `월간 결제 대비 약 ${annualSavings}% 절약`
                        : "매월 자동 갱신"}
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>
                    {plan?.displayPrice ?? "가격 확인 중"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            onPress={() => void startPurchase()}
            loading={busyAction === "purchase"}
            disabled={!connected || busyAction !== null}
            fullWidth
          >
            {selectedPeriod === "yearly" ? "연간으로 시작하기" : "월간으로 시작하기"}
          </Button>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="스토어에서 관리하기" />
        <View style={styles.card}>
          <ListRow
            title="구매 복원"
            description="같은 스토어 계정으로 결제한 구독을 다시 연결해요."
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
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="약관과 개인정보" />
        <View style={styles.card}>
          <ListRow
            title="이용약관"
            icon={ShieldCheck}
            onPress={() => void Linking.openURL(webUrl("/terms"))}
          />
          <ListRow
            title="개인정보처리방침"
            icon={ShieldCheck}
            onPress={() => void Linking.openURL(webUrl("/privacy"))}
            last
          />
        </View>
      </View>
    </Screen>
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
        ? [{
            period,
            displayPrice: product.displayPrice,
            price: product.price ?? null,
            productId: product.id,
          }]
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
      ? [{
          period,
          displayPrice: offer.displayPrice,
          price: offer.price,
          productId: product.id,
          offerToken: offer.offerTokenAndroid ?? undefined,
        }]
      : [];
  });
}

function getAnnualSavings(plans: StorePlan[]) {
  const monthly = plans.find((plan) => plan.period === "monthly")?.price;
  const yearly = plans.find((plan) => plan.period === "yearly")?.price;
  if (!monthly || !yearly || monthly <= 0) return null;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

function webUrl(path: string) {
  const configured = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}${path}`;
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "");
  return `${apiBase || "https://jango-app.kr"}${path}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

function trackFunnelEvent(
  event: Parameters<typeof trackMonetizationEvent>[0]["event"],
  properties?: Record<string, string>,
) {
  void trackMonetizationEvent({ event, properties }).catch(() => undefined);
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  planList: {
    gap: spacing.sm,
  },
  planCard: {
    minHeight: 80,
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
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  planCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  planTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  planDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  planPrice: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
});
