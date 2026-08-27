import type {
  AffiliateOffer,
  AffiliateTrackingMode,
  RecipeRecommendationDish,
} from "@expirymate/shared";
import { useEffect, useMemo, useRef } from "react";
import { router } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { SkeletonBlock } from "../../components/ContentSkeleton";
import { trackMonetizationEvent } from "../../services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
} from "../../shared/theme";
import { AffiliateCta } from "./affiliate-cta";
import { AffiliateDisclosure } from "./affiliate-disclosure";
import { useAffiliateOffers } from "./use-affiliate-offers";
import { AffiliateProductGroupView } from "./affiliate-product-group";
import { ingredientsWithoutProductGroups } from "./optional-missing-visibility";

export function OptionalMissingIngredientsCard({
  dish,
  recommendationId,
  dishIndex,
  onOpenShopping,
}: {
  dish: RecipeRecommendationDish;
  recommendationId: string;
  dishIndex: number;
  onOpenShopping?: () => void;
}) {
  const offersQuery = useAffiliateOffers(recommendationId, dishIndex);
  const trackedShownKey = useRef<string | null>(null);
  const trackingMode = offersQuery.data?.trackingMode ?? "none";
  const offers = useMemo(
    () => (offersQuery.data?.enabled ? offersQuery.data.offers : []),
    [offersQuery.data],
  );
  const productGroups = useMemo(
    () => (offersQuery.data?.enabled ? offersQuery.data.productGroups : []),
    [offersQuery.data],
  );
  const listedIngredients = useMemo(
    () =>
      offersQuery.isLoading
        ? []
        : ingredientsWithoutProductGroups(
            dish.optionalMissingIngredients,
            productGroups,
          ),
    [dish.optionalMissingIngredients, offersQuery.isLoading, productGroups],
  );
  const sharedLanding =
    productGroups.length === 0 && trackingMode === "partner_link"
      ? offers[0]
      : undefined;
  const offerByName = new Map(
    productGroups.length === 0 && trackingMode === "deeplink"
      ? offers.map((offer) => [offer.ingredientName, offer])
      : [],
  );

  useEffect(() => {
    if (
      !offersQuery.data?.enabled ||
      offers.length === 0 ||
      productGroups.length > 0
    ) {
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
    productGroups.length,
  ]);

  if (dish.optionalMissingIngredients.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <AppText variant="label" tone="subtext">있으면 더 맛있어져요</AppText>
      {listedIngredients.length > 0 ? (
        <View style={styles.list}>
          {listedIngredients.map((ingredient) => {
            const offer = offerByName.get(ingredient.name);
            return (
              <View key={`${ingredient.name}-${ingredient.reason}`} style={styles.row}>
                <View style={styles.copy}>
                  <AppText variant="bodySmallStrong">{ingredient.name}</AppText>
                  <AppText variant="caption" tone="subtext">{ingredient.reason}</AppText>
                </View>
                {offer ? (
                  <AffiliateCta
                    onPress={() => void openOffer(offer, trackingMode)}
                    contextLabel={ingredient.name}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {offersQuery.isLoading ? (
        <View style={styles.productSkeleton} accessibilityLabel="관련 상품을 불러오고 있어요">
          <SkeletonBlock height={spacing.xxl * 2} width={spacing.xxl * 2} radiusToken="md" />
          <View style={styles.productSkeletonCopy}>
            <SkeletonBlock height={spacing.sm} width="88%" />
            <SkeletonBlock height={spacing.sm} width="42%" />
          </View>
        </View>
      ) : null}
      {offersQuery.isError ? (
        <AppText variant="caption" tone="subtext">
          상품을 불러오지 못했어요. 레시피는 그대로 이용할 수 있어요.
        </AppText>
      ) : null}
      {(offers.length > 0 || productGroups.length > 0) && offersQuery.data?.disclosure ? (
        <AffiliateDisclosure disclosure={offersQuery.data.disclosure} />
      ) : null}
      {productGroups.length > 0 ? (
        <View style={styles.productGroups}>
          {productGroups.map((group) => (
            <AffiliateProductGroupView
              key={`${group.placement}:${group.query}`}
              group={group}
            />
          ))}
        </View>
      ) : null}
      {sharedLanding ? (
        <AffiliateCta
          onPress={() => void openOffer(sharedLanding, trackingMode)}
          contextLabel="있으면 좋은 재료"
          accessibilityHint="특정 한 품목이 아니라 식재료를 둘러보는 페이지로 이동해요."
        />
      ) : null}
      {productGroups.length > 0 ? (
        <Pressable
          onPress={() => (onOpenShopping ? onOpenShopping() : router.push("/shopping"))}
          accessibilityRole="button"
          accessibilityLabel="장보기에서 더 찾아보기"
          style={({ pressed }) => [styles.shoppingLink, pressed && styles.ctaPressed]}
        >
          <AppText variant="bodySmall" tone="link">장보기에서 더 찾아보기</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

async function openOffer(
  offer: AffiliateOffer,
  trackingMode: AffiliateTrackingMode,
) {
  void trackMonetizationEvent({
    event: "affiliate_fallback_tapped",
    properties: {
      placement: "recipe_missing_ingredient",
      source: trackingMode === "deeplink" ? "deeplink_fallback" : "partner_link",
    },
  }).catch(() => undefined);

  try {
    const canOpen = await Linking.canOpenURL(offer.landingUrl);
    if (canOpen) {
      await Linking.openURL(offer.landingUrl);
      return;
    }
  } catch {
    // Fall through to the user-facing error below.
  }
  Alert.alert("링크를 열 수 없어요", "잠시 후 다시 시도해 주세요.");
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  productGroups: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  productSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    overflow: "hidden",
  },
  productSkeletonCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  row: {
    gap: spacing.xs,
  },
  copy: {
    gap: spacing.xxs,
  },
  ctaPressed: {
    backgroundColor: colors.surfacePressed,
  },
  shoppingLink: {
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
  },
});
