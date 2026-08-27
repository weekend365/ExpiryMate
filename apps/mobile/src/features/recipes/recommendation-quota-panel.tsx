import type { RecommendationAccess } from "@expirymate/shared";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import {
  REWARDED_AD_CTA_LABEL,
  resolveMonetizationOffer,
} from "../monetization/monetization-offer";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../shared/theme";

function offerLabel(kind: RecommendationAccess["offer"]["kind"]) {
  return resolveMonetizationOffer(kind).label;
}

export function RecommendationValueOfferCard({
  offerKind,
  onSelect,
}: {
  offerKind: RecommendationAccess["offer"]["kind"];
  onSelect: (kind: RecommendationAccess["offer"]["kind"]) => void;
}) {
  return (
    <View style={styles.valueOfferCard}>
      <View style={styles.valueOfferCopy}>
        <AppText style={styles.valueOfferTitle}>
          {offerKind === "jango_household"
            ? "가족 냉장고가 함께 움직이고 있어요"
            : "냉장고 관리가 습관이 되고 있어요"}
        </AppText>
        <AppText style={styles.valueOfferDescription}>
          {offerKind === "jango_household"
            ? "가족이 먹고 버린 재료를 한 리포트로 보고, 모두 광고 없이 추천받을 수 있어요."
            : "최근 30일 소비·폐기 흐름을 확인하고, 광고 없이 임박 재료로 계속 골라보세요."}
        </AppText>
      </View>
      <Button onPress={() => onSelect(offerKind)} fullWidth>
        {offerLabel(offerKind)}
      </Button>
    </View>
  );
}

export function RecommendationQuotaCard({
  canOfferRewardedAd,
  hasActiveEntitlement,
  showPersonalizedOffer,
  offerKind,
  offerPersonalized,
  alternativesLength,
  paidCreditsSalesEnabled,
  subscriptionsEnabled,
  isAdBusy,
  adLoading,
  onCreateRecommendation,
  onSelectOffer,
  onOpenAlternatives,
}: {
  canOfferRewardedAd: boolean;
  hasActiveEntitlement: boolean;
  showPersonalizedOffer: boolean;
  offerKind?: RecommendationAccess["offer"]["kind"];
  offerPersonalized?: boolean;
  alternativesLength: number;
  paidCreditsSalesEnabled: boolean;
  subscriptionsEnabled: boolean;
  isAdBusy: boolean;
  adLoading: boolean;
  onCreateRecommendation: () => void;
  onSelectOffer: (kind: RecommendationAccess["offer"]["kind"]) => void;
  onOpenAlternatives: () => void;
}) {
  return (
    <View style={styles.quotaCard}>
      <AppText style={styles.quotaTitle}>
        {canOfferRewardedAd
          ? "광고 한 편이면 추천을 이어갈 수 있어요"
          : "오늘은 추천을 조금 쉬어갈까요?"}
      </AppText>
      {!hasActiveEntitlement && canOfferRewardedAd ? (
        <Button
          onPress={() => void onCreateRecommendation()}
          loading={adLoading}
          disabled={isAdBusy}
          fullWidth
        >
          {REWARDED_AD_CTA_LABEL}
        </Button>
      ) : null}
      {showPersonalizedOffer && offerKind ? (
        <Button
          onPress={() => onSelectOffer(offerKind)}
          variant={canOfferRewardedAd ? "secondary" : undefined}
          fullWidth
        >
          {offerLabel(offerKind)}
        </Button>
      ) : null}
      {!hasActiveEntitlement && offerPersonalized && alternativesLength ? (
        <Pressable
          onPress={onOpenAlternatives}
          accessibilityRole="button"
          accessibilityLabel="다른 이용 방법 보기"
          style={({ pressed }) => [
            styles.quotaLink,
            pressed && styles.quotaLinkPressed,
          ]}
        >
          <AppText style={styles.quotaLinkText}>다른 방법</AppText>
        </Pressable>
      ) : null}
      {!hasActiveEntitlement &&
      !offerPersonalized &&
      paidCreditsSalesEnabled ? (
        <Button
          onPress={() => router.push("/settings/recommendation-credits")}
          variant="secondary"
          fullWidth
        >
          AI 추천권 충전하기
        </Button>
      ) : null}
      {!hasActiveEntitlement && !offerPersonalized && subscriptionsEnabled ? (
        <Pressable
          onPress={() => router.push("/settings/subscription")}
          accessibilityRole="button"
          accessibilityLabel="장고 플러스 살펴보기"
          style={({ pressed }) => [
            styles.quotaLink,
            pressed && styles.quotaLinkPressed,
          ]}
        >
          <AppText style={styles.quotaLinkText}>장고 플러스 살펴보기</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RecommendationOfferAlternativesSheet({
  visible,
  alternatives,
  onClose,
  onSelectOffer,
}: {
  visible: boolean;
  alternatives: RecommendationAccess["offer"]["kind"][];
  onClose: () => void;
  onSelectOffer: (kind: RecommendationAccess["offer"]["kind"]) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      mascotMood="idle"
      title="다른 이용 방법"
      description="지금 사용할 수 있는 방법만 모았어요."
    >
      <View style={styles.sheetFooter}>
        {alternatives.map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            onPress={() => onSelectOffer(kind)}
            fullWidth
          >
            {offerLabel(kind)}
          </Button>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  quotaCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  valueOfferCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  valueOfferCopy: { gap: spacing.xxs },
  valueOfferTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  valueOfferDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
  quotaTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  quotaLink: {
    alignSelf: "flex-start",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingRight: spacing.sm,
  },
  quotaLinkText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.primary,
  },
  quotaLinkPressed: {
    backgroundColor: colors.surfacePressed,
  },
  sheetFooter: {
    gap: spacing.sm,
  },
});
