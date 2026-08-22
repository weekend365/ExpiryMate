import type {
  AffiliatePlacement,
  AffiliateProduct,
  AffiliateProductGroup,
} from "@expirymate/shared";
import { ExternalLink } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { colors, radius, spacing, touchTarget, typography } from "../../shared/theme";
import { visibleIngredientReason } from "./affiliate-group-reason";
import { uniqueProductsById } from "./unique-affiliate-products";

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
          <Pressable
            onPress={() => void openFallback(group.fallbackUrl!, group.placement)}
            accessibilityRole="link"
            accessibilityLabel={`${group.ingredientName} 쿠팡에서 검색하기`}
            style={({ pressed }) => [
              styles.fallback,
              pressed && styles.ctaRowPressed,
            ]}
          >
            <AppText variant="bodyStrong" tone="primary">쿠팡에서 검색하기</AppText>
            <ExternalLink color={colors.primary} size={spacing.sm} strokeWidth={2.4} />
          </Pressable>
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

  useEffect(() => {
    const timer = setTimeout(() => onShown(product), 250);
    return () => clearTimeout(timer);
  }, [onShown, product]);

  return (
    <Pressable
      onPress={() => void openProduct(product, placement)}
      accessibilityRole="link"
      accessibilityLabel={`${product.productName}, ${formatProductPrice(product)}, 쿠팡에서 보기`}
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
            <AppText variant="bodySmall" numberOfLines={2} style={styles.productName}>
              {product.productName}
            </AppText>
            <View style={styles.productMeta}>
              <AppText variant="bodyStrong">{formatProductPrice(product)}</AppText>
              {product.isRocket ? <AppText style={styles.badge}>로켓배송</AppText> : null}
              {product.isFreeShipping ? (
                <AppText style={styles.badge}>무료배송</AppText>
              ) : null}
            </View>
            <View style={[styles.ctaRow, pressed && styles.ctaRowPressed]}>
              <AppText
                variant="caption"
                tone="primary"
                scaleRole="chrome"
                densityAware={false}
              >
                쿠팡에서 보기
              </AppText>
              <ExternalLink
                color={colors.primary}
                size={typography.caption.fontSize}
                strokeWidth={2.4}
                accessibilityElementsHidden
                importantForAccessibility="no"
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
    backgroundColor: colors.mutedSurface,
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
    paddingVertical: spacing.sm,
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
  productName: {
    color: colors.text,
  },
  productMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  badge: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  ctaRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  ctaRowPressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  fallback: {
    minHeight: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  productCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
});
