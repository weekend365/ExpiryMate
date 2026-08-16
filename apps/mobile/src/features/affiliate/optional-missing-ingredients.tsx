import type {
  AffiliateOffer,
  AffiliateTrackingMode,
  RecipeRecommendationDish,
} from "@expirymate/shared";
import { useEffect, useRef } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { trackMonetizationEvent } from "../../services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../shared/theme";
import { useAffiliateOffers } from "./use-affiliate-offers";

export function OptionalMissingIngredientsCard({
  dish,
  recommendationId,
  dishIndex,
}: {
  dish: RecipeRecommendationDish;
  recommendationId: string;
  dishIndex: number;
}) {
  const offersQuery = useAffiliateOffers(recommendationId, dishIndex);
  const trackedShownKey = useRef<string | null>(null);
  const trackingMode = offersQuery.data?.trackingMode ?? "none";
  const offers = offersQuery.data?.enabled ? offersQuery.data.offers : [];
  const sharedLanding = trackingMode === "partner_link" ? offers[0] : undefined;
  const offerByName = new Map(
    trackingMode === "deeplink"
      ? offers.map((offer) => [offer.ingredientName, offer])
      : [],
  );

  useEffect(() => {
    if (!offersQuery.data?.enabled || offers.length === 0) {
      return;
    }

    const key = `${recommendationId}:${dishIndex}:${offers
      .map((offer) => offer.query)
      .join(",")}`;
    if (trackedShownKey.current === key) {
      return;
    }
    trackedShownKey.current = key;
    void trackMonetizationEvent({
      event: "affiliate_offer_shown",
      properties: {
        count: String(offers.length),
        mode: offersQuery.data.trackingMode,
      },
    }).catch(() => undefined);
  }, [
    dishIndex,
    offers,
    offersQuery.data?.enabled,
    offersQuery.data?.trackingMode,
    recommendationId,
  ]);

  if (dish.optionalMissingIngredients.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>있으면 더 맛있어져요</Text>
      <View style={styles.list}>
        {dish.optionalMissingIngredients.map((ingredient) => {
          const offer = offerByName.get(ingredient.name);
          return (
            <View key={`${ingredient.name}-${ingredient.reason}`} style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{ingredient.name}</Text>
                <Text style={styles.reason}>{ingredient.reason}</Text>
              </View>
              {offer ? (
                <Pressable
                  onPress={() => void openOffer(offer, trackingMode)}
                  accessibilityRole="link"
                  accessibilityLabel={`${ingredient.name} 쿠팡에서 찾아보기`}
                  style={({ pressed }) => [
                    styles.cta,
                    pressed && styles.ctaPressed,
                  ]}
                >
                  <Text style={styles.ctaLabel}>쿠팡에서 찾아보기</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      {sharedLanding ? (
        <Pressable
          onPress={() => void openOffer(sharedLanding, trackingMode)}
          accessibilityRole="link"
          accessibilityLabel="있으면 좋은 재료를 쿠팡에서 둘러보기"
          accessibilityHint="특정 한 품목이 아니라 식재료를 둘러보는 페이지로 이동해요."
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>이 재료들, 쿠팡에서 둘러볼까요?</Text>
        </Pressable>
      ) : null}
      {offers.length > 0 && offersQuery.data?.disclosure ? (
        <Text style={styles.disclosure}>{offersQuery.data.disclosure}</Text>
      ) : null}
    </View>
  );
}

async function openOffer(
  offer: AffiliateOffer,
  trackingMode: AffiliateTrackingMode,
) {
  void trackMonetizationEvent({
    event: "affiliate_offer_tapped",
    properties: {
      query: offer.query.slice(0, 40),
      tracked: offer.tracked ? "true" : "false",
      mode: trackingMode,
    },
  }).catch(() => undefined);

  const canOpen = await Linking.canOpenURL(offer.landingUrl);
  if (!canOpen) {
    return;
  }
  await Linking.openURL(offer.landingUrl);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.xs,
  },
  copy: {
    gap: spacing.xxs,
  },
  name: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  reason: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  cta: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  ctaPressed: {
    backgroundColor: colors.surfacePressed,
  },
  ctaLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  disclosure: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
});
