import type {
  AffiliatePlacement,
  AffiliateProduct,
  AffiliateProductGroup,
} from "@expirymate/shared";
import { COUPANG_PARTNERS_CTA_LABEL } from "@expirymate/shared";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "../../components/AppText";
import { trackMonetizationEvent } from "../../services/api";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { colors, radius, spacing, touchTarget } from "../../shared/theme";
import { AffiliateCta } from "./affiliate-cta";
import { visibleIngredientReason } from "./affiliate-group-reason";
import { uniqueProductsById } from "./unique-affiliate-products";
import { useVisibleImpression } from "./use-visible-impression";

const PRODUCT_IMAGE_SIZE = spacing.xxl * 2;

export function AffiliateProductGroupView({
  group,
  headingBand = false,
}: {
  group: AffiliateProductGroup;
  /** Full-bleed header bar so stacked ingredients read as separate groups. */
  headingBand?: boolean;
}) {
  const trackedProducts = useRef(new Set<string>());
  const groupRef = useRef(group);
  groupRef.current = group;

  const handleShown = useCallback((product: AffiliateProduct) => {
    if (trackedProducts.current.has(product.productId)) return;
    trackedProducts.current.add(product.productId);
    void trackMonetizationEvent({
      event: "affiliate_product_shown",
      properties: {
        placement: groupRef.current.placement,
        productId: product.productId,
        source: "product_search",
      },
    }).catch(() => undefined);
  }, []);

  if (group.products.length === 0 && group.placement === "shopping_recently_consumed") {
    return null;
  }

  const ingredientReason = visibleIngredientReason(group.reason);
  const products = uniqueProductsById(group.products);

  return (
    <View style={[styles.group, headingBand && styles.groupBanded]}>
      <View
        style={[styles.heading, headingBand && styles.headingBand]}
        accessibilityRole="header"
        accessibilityLabel={
          ingredientReason
            ? `${group.ingredientName}. ${ingredientReason}`
            : group.ingredientName
        }
      >
        <AppText variant="bodyStrong">{group.ingredientName}</AppText>
        {ingredientReason ? (
          <AppText variant="caption" tone="subtext">{ingredientReason}</AppText>
        ) : null}
      </View>
      {products.length > 0 ? (
        <View style={[styles.productList, headingBand && styles.groupBody]}>
          {products.map((product, index) => (
            <ProductCard
              key={`${product.productId}:${index}`}
              product={product}
              placement={group.placement}
              last={index === products.length - 1}
              onShown={handleShown}
            />
          ))}
        </View>
      ) : group.fallbackUrl ? (
        <View style={headingBand ? styles.groupBody : undefined}>
          <AffiliateCta
            contextLabel={group.ingredientName}
            onPress={() => void openFallback(group.fallbackUrl!, group.placement)}
          />
        </View>
      ) : null}
    </View>
  );
}

function ProductCard({
  product,
  placement,
  last,
  onShown,
}: {
  product: AffiliateProduct;
  placement: AffiliatePlacement;
  last: boolean;
  onShown: (product: AffiliateProduct) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const { shouldStack } = useResponsiveLayout();

  const impressionRef = useVisibleImpression({
    impressionKey: `${placement}:${product.productId}`,
    onVisible: () => onShown(product),
  });

  return (
    <Pressable
      ref={impressionRef}
      onPress={() => void openProduct(product, placement)}
      accessibilityRole="link"
      accessibilityLabel={`${product.productName}, ${formatProductPrice(product)}, ${COUPANG_PARTNERS_CTA_LABEL}`}
      style={({ pressed }) => [
        styles.productCard,
        shouldStack && styles.productCardStacked,
        !last && styles.productCardDivider,
        pressed && styles.productCardPressed,
      ]}
    >
      {({ pressed }) => (
        <>
          {imageFailed ? (
            <View style={[styles.productImage, styles.imageFallback]}>
              <AppText variant="caption" tone="subtext">이미지 없음</AppText>
            </View>
          ) : (
            <Image
              source={{ uri: product.productImage }}
              style={styles.productImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              onError={() => setImageFailed(true)}
            />
          )}
          <View style={styles.productCopy}>
            <AppText
              variant="bodySmall"
              numberOfLines={shouldStack ? undefined : 2}
            >
              {product.productName}
            </AppText>
            <View
              style={[
                styles.productPurchaseRow,
                shouldStack && styles.productPurchaseRowStacked,
              ]}
            >
              <View style={styles.productMeta}>
                <AppText variant="bodyStrong">{formatProductPrice(product)}</AppText>
                {product.isRocket ? (
                  <AppText variant="captionStrong" tone="link">로켓배송</AppText>
                ) : null}
                {product.isFreeShipping ? (
                  <AppText variant="captionStrong" tone="link">무료배송</AppText>
                ) : null}
              </View>
              <AffiliateCta
                contextLabel={product.productName}
                mode="inline"
                pressed={pressed}
              />
            </View>
          </View>
        </>
      )}
    </Pressable>
  );
}

function formatProductPrice(product: AffiliateProduct) {
  if (product.stale || product.productPrice === null) return "쿠팡에서 가격 확인";
  return `${product.productPrice.toLocaleString("ko-KR")}원`;
}

async function openProduct(product: AffiliateProduct, placement: AffiliatePlacement) {
  void trackMonetizationEvent({
    event: "affiliate_product_tapped",
    properties: {
      placement,
      productId: product.productId,
      source: "product_search",
    },
  }).catch(() => undefined);
  await openUrl(product.productUrl);
}

async function openFallback(url: string, placement: AffiliatePlacement) {
  void trackMonetizationEvent({
    event: "affiliate_fallback_tapped",
    properties: { placement, source: "search_fallback" },
  }).catch(() => undefined);
  await openUrl(url);
}

async function openUrl(url: string) {
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // Fall through to the user-facing error below.
  }
  Alert.alert("링크를 열 수 없어요", "잠시 후 다시 시도해 주세요.");
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  groupBanded: {
    gap: spacing.none,
  },
  heading: {
    gap: spacing.xxs,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headingBand: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  groupBody: {
    paddingHorizontal: spacing.sm,
  },
  productList: {
    paddingTop: spacing.xxs,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget.min,
    paddingVertical: spacing.xs,
  },
  productCardStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  productCardDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  productImage: {
    width: PRODUCT_IMAGE_SIZE,
    height: PRODUCT_IMAGE_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.mutedSurface,
  },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  productCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  productMeta: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xxs,
  },
  productPurchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  productPurchaseRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  productCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
});
