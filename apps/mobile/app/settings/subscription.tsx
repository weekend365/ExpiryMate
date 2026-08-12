import { productCategoryLabels, type ProductCategory } from "@expirymate/shared";
import { useQuery } from "@tanstack/react-query";
import type { Purchase, ProductSubscription } from "expo-iap";
import {
  deepLinkToSubscriptions,
  getAvailablePurchases,
  useIAP,
} from "expo-iap";
import {
  CreditCard,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
} from "lucide-react-native";
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
import { useAuth } from "../../src/features/auth/use-auth";
import { withSessionUser } from "../../src/features/auth/session-boundary";
import {
  formatSubscriptionExpiry,
  formatSubscriptionStore,
} from "../../src/features/settings/settings-format";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import {
  getHouseholdInsights,
  getPlusInsights,
  trackMonetizationEvent,
  type PlusInsights,
} from "../../src/services/api";
import { colors, radius, spacing, typography } from "../../src/shared/theme";
import { useActiveSpace } from "../../src/features/spaces/space-provider";

const APPLE_MONTHLY_ID = "expirymate_premium_monthly";
const APPLE_YEARLY_ID = "expirymate_premium_yearly";
const GOOGLE_PRODUCT_ID = "jango_plus";
const APPLE_HOUSEHOLD_MONTHLY_ID = "expirymate_household_monthly";
const APPLE_HOUSEHOLD_YEARLY_ID = "expirymate_household_yearly";
const GOOGLE_HOUSEHOLD_PRODUCT_ID = "jango_household";
const PACKAGE_NAME = "com.expirymate.mobile";

type BillingPeriod = "monthly" | "yearly";
type PlanCode = "jango_plus" | "jango_household";
type StorePlan = {
  period: BillingPeriod;
  displayPrice: string;
  price: number | null;
  productId: string;
  offerToken?: string;
  planCode: PlanCode;
};

export default function SubscriptionSettingsScreen() {
  const subscription = useSubscriptionEntitlement();
  const monetization = useMonetization();
  const { sessionUserId } = useAuth();
  const { activeSpaceId, spaces } = useActiveSpace();
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const householdEligible = Boolean(
    monetization.access?.householdSubscriptionsEnabled &&
    activeSpace?.type === "household" &&
      activeSpace.myRole === "owner" &&
      activeSpace.memberCount <= 5,
  );
  const entitlement = subscription.query.data;
  const hasActiveEntitlement = Boolean(entitlement?.hasActiveEntitlement);
  const insightsQuery = useQuery({
    queryKey: withSessionUser(
      ["subscriptions", "plus-insights", entitlement?.planCode ?? "none", activeSpaceId ?? "no-space"],
      sessionUserId,
    ),
    queryFn: () =>
      entitlement?.planCode === "jango_household" && activeSpaceId
        ? getHouseholdInsights(activeSpaceId)
        : getPlusInsights(),
    enabled: hasActiveEntitlement,
  });
  const [selectedPeriod, setSelectedPeriod] =
    useState<BillingPeriod>("yearly");
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>(
    householdEligible ? "jango_household" : "jango_plus",
  );
  const [busyAction, setBusyAction] = useState<
    "purchase" | "restore" | null
  >(null);
  const appliedExperimentRef = useRef(false);
  const trackedPaywallRef = useRef(false);
  const purchaseCompletedRef = useRef(false);
  const selectedPlanCodeRef = useRef<PlanCode>(selectedPlanCode);
  selectedPlanCodeRef.current = selectedPlanCode;

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
            spaceId: isHouseholdProduct(purchase.productId)
              ? activeSpaceId
              : undefined,
            }
          : {
              store: "google_play" as const,
              productId: purchase.productId,
              purchaseToken: purchase.purchaseToken ?? undefined,
              basePlanId: purchase.currentPlanId ?? selectedPeriod,
              spaceId: isHouseholdProduct(purchase.productId)
                ? activeSpaceId
                : undefined,
            };
      await subscription.verifyMutation.mutateAsync(verification);
      await finishTransaction({ purchase, isConsumable: false });
      purchaseCompletedRef.current = true;
      trackFunnelEvent("purchase_verified", {
        store: Platform.OS,
        product_id: purchase.productId,
        billing_period: purchase.currentPlanId ?? selectedPeriod,
      });
      setBusyAction(null);
      Alert.alert(
        "장고 플러스가 시작됐어요",
        selectedPlanCodeRef.current === "jango_household"
          ? "가족 공간의 소비·폐기 흐름을 함께 보고, 광고 없이 요리를 추천받을 수 있어요."
          : "내 냉장고의 소비·폐기 흐름을 보고, 광고 없이 요리를 추천받을 수 있어요.",
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
          ? [
              APPLE_MONTHLY_ID,
              APPLE_YEARLY_ID,
              APPLE_HOUSEHOLD_MONTHLY_ID,
              APPLE_HOUSEHOLD_YEARLY_ID,
            ]
          : [GOOGLE_PRODUCT_ID, GOOGLE_HOUSEHOLD_PRODUCT_ID],
      type: "subs",
    });
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (!householdEligible && selectedPlanCode === "jango_household") {
      setSelectedPlanCode("jango_plus");
    } else if (
      householdEligible &&
      monetization.access?.offer.kind === "jango_household"
    ) {
      setSelectedPlanCode("jango_household");
    }
  }, [
    householdEligible,
    monetization.access?.offer.kind,
    selectedPlanCode,
  ]);

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

  useEffect(
    () => () => {
      if (trackedPaywallRef.current && !purchaseCompletedRef.current) {
        trackFunnelEvent("paywall_dismissed", {
          plan_code: selectedPlanCodeRef.current,
        });
      }
    },
    [],
  );

  const plans = useMemo(
    () => resolvePlans(subscriptions, selectedPlanCode),
    [selectedPlanCode, subscriptions],
  );
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
      plan_code: selectedPlan.planCode,
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
      skuAndroid:
        entitlement?.planCode === "jango_household"
          ? GOOGLE_HOUSEHOLD_PRODUCT_ID
          : GOOGLE_PRODUCT_ID,
      packageNameAndroid: PACKAGE_NAME,
    }).catch((error) =>
      Alert.alert("구독 관리를 열지 못했어요", getErrorMessage(error)),
    );

  return (
    <Screen
      title="장고 플러스"
      subtitle={
        entitlement?.planCode === "jango_household" || selectedPlanCode === "jango_household"
          ? "가족의 소비와 폐기를 함께 줄이는 냉장고 관리"
          : "임박 재료를 놓치지 않고 식탁까지 이어주는 관리"
      }
    >
      <View style={styles.section}>
        <SectionHeader
          title="지금 상태"
          description="구독 혜택은 결제 기간이 끝날 때까지 유지돼요."
        />
        <View style={styles.card}>
          <ListRow
            title={
              hasActiveEntitlement
                ? entitlement?.planCode === "jango_household"
                  ? "가족 플러스를 이용 중이에요"
                  : "장고 플러스를 이용 중이에요"
                : "무료 이용 중이에요"
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

      <View style={styles.section}>
        <SectionHeader
          title="냉장고를 덜 버리는 습관"
          description="몇 번 추천받는지보다 무엇을 먹고 버렸는지 꾸준히 확인할 수 있어요."
        />
        <View style={styles.benefitCard}>
          <BenefitLine
            text={
              entitlement?.planCode === "jango_household" || selectedPlanCode === "jango_household"
                ? "가족 공간의 최근 30일 소비·폐기 흐름과 폐기 비율"
                : "나의 최근 30일 소비·폐기 흐름과 폐기 비율"
            }
          />
          <BenefitLine
            text={
              entitlement?.planCode === "jango_household" || selectedPlanCode === "jango_household"
                ? `최대 5명이 광고 없이 AI 추천을 함께 사용해요 · 하루 최대 ${monetization.access?.householdDailyLimit ?? 60}회`
                : `광고 없이 임박 재료로 요리를 충분히 골라요 · 하루 최대 ${monetization.access?.subscriberDailyLimit ?? 30}회`
            }
          />
          {(entitlement?.planCode === "jango_household" || selectedPlanCode === "jango_household") ? (
            <BenefitLine text="구성원이 함께 쓴 재료와 버린 재료를 한 리포트로 확인" />
          ) : null}
          <BenefitLine text="구독 중 바코드 추천권 적립 및 잔액 보존" />
        </View>
      </View>

      {hasActiveEntitlement ? (
        <View style={styles.section}>
          <SectionHeader
            title="나의 30일 소비 리포트"
            description="소비·폐기로 상태를 바꾼 재료를 기준으로 계산해요."
          />
          <View style={styles.insightGrid}>
            <InsightValue label="소비 완료" value={insightsQuery.data?.consumed ?? 0} suffix="개" />
            <InsightValue label="폐기" value={insightsQuery.data?.discarded ?? 0} suffix="개" />
            <InsightValue label="폐기 비율" value={insightsQuery.data?.wasteRatePercent ?? 0} suffix="%" />
            <InsightValue label="7일 내 만료" value={insightsQuery.data?.expiringSoon ?? 0} suffix="개" />
          </View>
          {insightsQuery.data?.weekly ? (
            <WeeklyTrendCard weekly={insightsQuery.data.weekly} />
          ) : null}
          {insightsQuery.data?.actions.length ? (
            <View style={styles.insightActions}>
              <SectionHeader
                title="이번 주 실천 제안"
                description="실제 재고와 소비·폐기 기록을 기준으로 골랐어요."
              />
              {insightsQuery.data.actions.map((action) => (
                <InsightActionCard key={action.kind} action={action} />
              ))}
            </View>
          ) : null}
          {insightsQuery.data?.topDiscardedCategories.length ? (
            <Text style={styles.insightFootnote}>
              자주 버린 분류 · {insightsQuery.data.topDiscardedCategories
                .map((item) => `${productCategoryLabels[item.category as ProductCategory] ?? item.category} ${item.count}개`)
                .join(" · ")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!hasActiveEntitlement && monetization.access?.subscriptionsEnabled ? (
        <View style={styles.section}>
          {householdEligible ? (
            <>
              <SectionHeader
                title="플러스 종류"
                description="나만 쓰거나 가족 공간 전체가 함께 쓸 수 있어요."
              />
              <View style={styles.planList}>
                {(["jango_plus", "jango_household"] as const).map((planCode) => (
                  <Pressable
                    key={planCode}
                    onPress={() => {
                      setSelectedPlanCode(planCode);
                      trackFunnelEvent("plan_selected", { plan_code: planCode });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedPlanCode === planCode }}
                    style={[
                      styles.planCard,
                      selectedPlanCode === planCode && styles.planCardSelected,
                    ]}
                  >
                    <View style={styles.planCopy}>
                      <Text style={styles.planTitle}>
                        {planCode === "jango_household" ? "가족 플러스" : "개인 플러스"}
                      </Text>
                      <Text style={styles.planDescription}>
                        {planCode === "jango_household"
                          ? "가족 소비·폐기 리포트 · 최대 5명"
                          : "나의 소비·폐기 리포트 · 광고 없음"}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
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
                      plan_code: selectedPlanCode,
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
      ) : !hasActiveEntitlement ? (
        <View style={styles.section}>
          <SectionHeader
            title="지금은 신규 가입을 쉬고 있어요"
            description="이미 결제하신 구독은 복원으로 다시 연결할 수 있고, 이용 중인 혜택은 그대로 유지돼요."
          />
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

function resolvePlans(
  products: ProductSubscription[],
  planCode: PlanCode,
): StorePlan[] {
  if (Platform.OS === "ios") {
    const monthlyId =
      planCode === "jango_household"
        ? APPLE_HOUSEHOLD_MONTHLY_ID
        : APPLE_MONTHLY_ID;
    const yearlyId =
      planCode === "jango_household"
        ? APPLE_HOUSEHOLD_YEARLY_ID
        : APPLE_YEARLY_ID;
    return products.flatMap((product) => {
      if (product.platform !== "ios") return [];
      const period =
        product.id === yearlyId
          ? "yearly"
          : product.id === monthlyId
            ? "monthly"
            : null;
      return period
        ? [{
            period,
            displayPrice: product.displayPrice,
            price: product.price ?? null,
            productId: product.id,
            planCode,
          }]
        : [];
    });
  }

  const googleProductId =
    planCode === "jango_household"
      ? GOOGLE_HOUSEHOLD_PRODUCT_ID
      : GOOGLE_PRODUCT_ID;
  const product = products.find(
    (item) => item.platform === "android" && item.id === googleProductId,
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
          planCode,
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

function isHouseholdProduct(productId: string) {
  return productId.includes("household");
}

function BenefitLine({ text }: { text: string }) {
  return (
    <View style={styles.benefitLine}>
      <Text style={styles.benefitCheck}>✓</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function InsightValue({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <View style={styles.insightValue}>
      <Text style={styles.insightNumber}>{value}{suffix}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

function WeeklyTrendCard({ weekly }: { weekly: PlusInsights["weekly"] }) {
  const change = weekly.wasteRateChangePercentagePoints;
  const trendCopy =
    weekly.trend === "improved"
      ? `지난 7일보다 폐기 비율이 ${Math.abs(change ?? 0)}%p 줄었어요.`
      : weekly.trend === "worse"
        ? `지난 7일보다 폐기 비율이 ${Math.abs(change ?? 0)}%p 늘었어요.`
        : weekly.trend === "steady"
          ? "지난 7일과 비슷한 폐기 비율을 유지하고 있어요."
          : "2주간 기록이 쌓이면 폐기 변화를 비교해 드릴게요.";
  return (
    <View style={styles.weeklyTrendCard}>
      <View style={styles.weeklyTrendHeader}>
        <Text style={styles.weeklyTrendTitle}>이번 주 습관 변화</Text>
        <Text style={styles.weeklyTrendPeriod}>
          {weekly.current.from.slice(5)}~{weekly.current.to.slice(5)}
        </Text>
      </View>
      <Text style={styles.weeklyTrendSummary}>
        소비 {weekly.current.consumed}개 · 폐기 {weekly.current.discarded}개 · 폐기 비율 {weekly.current.wasteRatePercent}%
      </Text>
      <Text
        style={[
          styles.weeklyTrendCopy,
          weekly.trend === "improved" && styles.weeklyTrendCopyImproved,
          weekly.trend === "worse" && styles.weeklyTrendCopyWorse,
        ]}
      >
        {trendCopy}
      </Text>
    </View>
  );
}

function InsightActionCard({
  action,
}: {
  action: PlusInsights["actions"][number];
}) {
  const copy = getInsightActionCopy(action);
  return (
    <View style={styles.insightActionCard}>
      <View style={styles.insightActionIcon}>
        <Lightbulb color={colors.primary} size={20} />
      </View>
      <View style={styles.insightActionCopy}>
        <Text style={styles.insightActionTitle}>{copy.title}</Text>
        <Text style={styles.insightActionDescription}>{copy.description}</Text>
      </View>
    </View>
  );
}

function getInsightActionCopy(action: PlusInsights["actions"][number]) {
  if (action.kind === "use_expiring") {
    const names = action.itemNames.length
      ? action.itemNames.join(", ")
      : "임박 재료";
    const date = action.nearestExpiryDate?.slice(5).replace("-", "/");
    return {
      title: `만료 임박 ${action.count}개 먼저 사용하기`,
      description: `${names}${date ? ` · 가장 가까운 기한 ${date}` : ""}`,
    };
  }
  if (action.kind === "reduce_category_waste") {
    const category = action.category
      ? productCategoryLabels[action.category as ProductCategory] ??
        action.category
      : "자주 버린 분류";
    return {
      title: `${category} 구매량 한 번 점검하기`,
      description: `최근 30일 동안 ${action.count}개를 폐기했어요. 다음 구매량을 조금 줄여보세요.`,
    };
  }
  if (action.kind === "review_waste_trend") {
    return {
      title: "이번 주 폐기 원인 돌아보기",
      description: "지난주보다 폐기 비율이 높아졌어요. 보관 위치와 구매량을 확인해보세요.",
    };
  }
  return {
    title: "좋아진 소비 흐름 이어가기",
    description: "지난주보다 폐기 비율이 낮아졌어요. 지금의 구매량과 소비 순서를 유지해보세요.",
  };
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
  benefitCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
  },
  benefitLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  benefitCheck: { fontSize: typography.body.fontSize, fontWeight: "900", color: colors.primary },
  benefitText: { flex: 1, fontSize: typography.bodySmall.fontSize, color: colors.text },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  insightValue: {
    width: "48%",
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightNumber: { fontSize: typography.title.fontSize, fontWeight: "900", color: colors.text },
  insightLabel: { marginTop: spacing.xxs, fontSize: typography.caption.fontSize, color: colors.subtext },
  insightFootnote: { fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, color: colors.subtext },
  insightActions: { gap: spacing.sm },
  insightActionCard: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  insightActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  insightActionCopy: { flex: 1, gap: spacing.xxs },
  insightActionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: "800",
    color: colors.text,
  },
  insightActionDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    color: colors.subtext,
  },
  weeklyTrendCard: {
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
  },
  weeklyTrendHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  weeklyTrendTitle: { fontSize: typography.bodySmall.fontSize, fontWeight: "800", color: colors.text },
  weeklyTrendPeriod: { fontSize: typography.caption.fontSize, color: colors.subtext },
  weeklyTrendSummary: { fontSize: typography.bodySmall.fontSize, color: colors.text },
  weeklyTrendCopy: { fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, color: colors.subtext },
  weeklyTrendCopyImproved: { color: colors.success },
  weeklyTrendCopyWorse: { color: colors.danger },
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
