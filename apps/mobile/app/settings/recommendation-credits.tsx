import type { Product, Purchase } from "expo-iap";
import { useIAP } from "expo-iap";
import { ShieldCheck, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import {
  trackMonetizationEvent,
  verifyRecommendationCreditPurchase,
} from "../../src/services/api";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { colors, radius, spacing, touchTarget } from "../../src/shared/theme";

export default function RecommendationCreditsScreen() {
  const { shouldStack } = useResponsiveLayout();
  const monetization = useMonetization();
  const configuredProducts = useMemo(
    () => monetization.access?.paidCredits.products ?? [],
    [monetization.access?.paidCredits.products],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const viewedRef = useRef(false);

  async function handlePurchase(purchase: Purchase) {
    if (purchase.purchaseState === "pending") {
      setPurchasing(false);
      Alert.alert("결제가 확인 중이에요", "스토어에서 완료되면 추천권을 지급할게요.");
      return;
    }
    try {
      const result = await verifyRecommendationCreditPurchase(
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
      await finishTransaction({ purchase, isConsumable: true });
      await monetization.refresh();
      setPurchasing(false);
      Alert.alert(
        result.creditsGranted > 0 ? "추천권이 충전됐어요" : "이미 반영된 구매예요",
        `현재 추천권 ${result.balance}회를 보유하고 있어요.`,
      );
    } catch (error) {
      setPurchasing(false);
      track("credit_checkout_failed", {
        stage: "verification",
        reason: error instanceof Error ? error.name : "unknown",
      });
      Alert.alert(
        "추천권 구매를 확인하지 못했어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      );
    }
  }

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: (purchase) => void handlePurchase(purchase),
    onPurchaseError: (error) => {
      setPurchasing(false);
      const cancelled = String(error.code).toLowerCase().includes("cancel");
      track(
        cancelled ? "credit_checkout_cancelled" : "credit_checkout_failed",
        { reason: String(error.code) },
      );
      if (!cancelled) Alert.alert("결제를 완료하지 못했어요", error.message);
    },
  });

  useEffect(() => {
    if (!connected || configuredProducts.length === 0) return;
    void fetchProducts({
      skus: configuredProducts.map((product) => product.productId),
      type: "in-app",
    });
  }, [configuredProducts, connected, fetchProducts]);

  useEffect(() => {
    if (!selectedId && configuredProducts.length > 0) {
      setSelectedId(configuredProducts[0]?.productId ?? null);
    }
  }, [configuredProducts, selectedId]);

  useEffect(() => {
    if (viewedRef.current || !monetization.access?.paidCredits.salesEnabled) return;
    viewedRef.current = true;
    track("credit_pack_viewed");
  }, [monetization.access?.paidCredits.salesEnabled]);

  const storeProducts = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const selectedProduct = selectedId ? storeProducts.get(selectedId) : undefined;

  const startPurchase = async () => {
    if (!selectedId || !selectedProduct) {
      Alert.alert("가격을 불러오는 중이에요", "스토어 연결 후 잠시 뒤 다시 시도해 주세요.");
      return;
    }
    setPurchasing(true);
    const credits = configuredProducts.find((item) => item.productId === selectedId)?.credits;
    track("credit_checkout_started", {
      product_id: selectedId,
      credits: String(credits ?? 0),
    });
    try {
      await requestPurchase({
        type: "in-app",
        request:
          Platform.OS === "ios"
            ? { apple: { sku: selectedId } }
            : { google: { skus: [selectedId] } },
      });
    } catch (error) {
      setPurchasing(false);
      track("credit_checkout_failed", { stage: "request_purchase" });
      Alert.alert(
        "결제를 시작하지 못했어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      );
    }
  };

  return (
    <SettingsScreen>
      <SettingsGroup
        title="필요한 만큼 충전하기"
        description={`현재 ${monetization.access?.paidCredits.balance ?? 0}회 보유 · 자동 갱신되지 않아요.`}
        content="plain"
      >
        <View style={styles.list}>
          {configuredProducts.map((configured) => (
            <CreditProductCard
              key={configured.productId}
              configured={configured}
              product={storeProducts.get(configured.productId)}
              selected={selectedId === configured.productId}
              onSelect={() => {
                setSelectedId(configured.productId);
                track("credit_pack_selected", {
                  product_id: configured.productId,
                  credits: String(configured.credits),
                });
              }}
            />
          ))}
        </View>
      </SettingsGroup>
      <Button
        onPress={() => void startPurchase()}
        loading={purchasing}
        disabled={!connected || purchasing || !selectedProduct}
        fullWidth
      >
        추천권 충전하기
      </Button>

      <View style={[styles.guideCard, shouldStack && styles.guideCardStacked]}>
        <ShieldCheck color={colors.primary} size={spacing.md} />
        <View style={styles.guideCopy}>
          <AppText variant="bodySmallStrong">서버에서 구매를 확인해요</AppText>
          <AppText variant="caption" tone="subtext">
            무료 추천을 먼저 사용하고, 이후 구매 추천권이 자동으로 차감돼요. 추천 생성에 실패하면 차감되지 않아요.
          </AppText>
        </View>
      </View>
    </SettingsScreen>
  );
}

function CreditProductCard({ configured, product, selected, onSelect }: {
  configured: { productId: string; credits: number };
  product?: Product;
  selected: boolean;
  onSelect: () => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.productCard,
        shouldStack && styles.productCardStacked,
        selected && styles.productCardSelected,
      ]}
    >
      <View style={styles.productTitleRow}>
        <Sparkles
          color={selected ? colors.primary : colors.subtext}
          size={spacing.sm + spacing.xxs}
        />
        <AppText variant="bodyStrong">AI 추천 {configured.credits}회</AppText>
      </View>
      <AppText variant="bodyStrong">
        {product?.displayPrice ?? "가격 확인 중"}
      </AppText>
    </Pressable>
  );
}

function track(
  event: Parameters<typeof trackMonetizationEvent>[0]["event"],
  properties?: Record<string, string>,
) {
  void trackMonetizationEvent({ event, properties }).catch(() => undefined);
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.min,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  productCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  productCardStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.xs,
  },
  productTitleRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  guideCard: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
  },
  guideCardStacked: { flexDirection: "column" },
  guideCopy: { flex: 1, gap: spacing.xxs },
});
