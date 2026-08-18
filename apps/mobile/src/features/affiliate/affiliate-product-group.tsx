import type {
  AffiliatePlacement,
  AffiliateProduct,
  AffiliateProductGroup,
} from "@expirymate/shared";
import { ExternalLink } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  type ViewToken,
  View,
} from "react-native";
import { AppText } from "../../components/AppText";
import { trackMonetizationEvent } from "../../services/api";
import { colors, radius, spacing, touchTarget, typography } from "../../shared/theme";

export function AffiliateProductGroupView({
  group,
}: {
  group: AffiliateProductGroup;
}) {
  const trackedProducts = useRef(new Set<string>());
  const groupRef = useRef(group);
  groupRef.current = group;
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 250,
  });
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<AffiliateProduct>> }) => {
      for (const viewable of viewableItems) {
        const product = viewable.item;
        if (!viewable.isViewable || trackedProducts.current.has(product.productId)) {
          continue;
        }
        trackedProducts.current.add(product.productId);
        void trackMonetizationEvent({
          event: "affiliate_product_shown",
          properties: {
            placement: groupRef.current.placement,
            productId: product.productId,
            source: "product_search",
          },
        }).catch(() => undefined);
      }
    },
  );

  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <AppText variant="bodyStrong">{group.ingredientName}</AppText>
        {group.reason ? (
          <AppText variant="caption" tone="subtext">{group.reason}</AppText>
        ) : null}
      </View>
      {group.products.length > 0 ? (
        <FlatList
          data={group.products}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productList}
          keyExtractor={(product) => product.productId}
          renderItem={({ item: product }) => (
            <ProductCard
              product={product}
              placement={group.placement}
            />
          )}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
        />
      ) : group.fallbackUrl ? (
        <Pressable
          onPress={() => void openFallback(group.fallbackUrl!, group.placement)}
          accessibilityRole="link"
          accessibilityLabel={`${group.ingredientName} 쿠팡에서 검색하기`}
          style={({ pressed }) => [
            styles.fallback,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="bodyStrong" tone="primary">쿠팡에서 검색하기</AppText>
          <ExternalLink color={colors.primary} size={spacing.sm} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProductCard({
  product,
  placement,
}: {
  product: AffiliateProduct;
  placement: AffiliatePlacement;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Pressable
      onPress={() => void openProduct(product, placement)}
      accessibilityRole="link"
      accessibilityLabel={`${product.productName}, ${formatProductPrice(product)}, 쿠팡에서 보기`}
      style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
    >
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
        <AppText variant="bodyStrong">{formatProductPrice(product)}</AppText>
        <View style={styles.badges}>
          {product.isRocket ? <AppText style={styles.badge}>로켓배송</AppText> : null}
          {product.isFreeShipping ? <AppText style={styles.badge}>무료배송</AppText> : null}
        </View>
        <AppText variant="caption" tone="primary">쿠팡에서 보기</AppText>
      </View>
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
  heading: { gap: spacing.xxs },
  productList: { gap: spacing.xs, paddingRight: spacing.sm },
  productCard: {
    width: 184,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  productImage: { width: "100%", height: 124, backgroundColor: colors.mutedSurface },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  productCopy: { minHeight: 144, padding: spacing.sm, gap: spacing.xs },
  productName: {
    minHeight: typography.bodySmall.lineHeight * 2,
    color: colors.text,
  },
  badges: { minHeight: typography.caption.lineHeight, flexDirection: "row", gap: spacing.xs },
  badge: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  fallback: {
    minHeight: touchTarget.min,
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
  pressed: { opacity: 0.72 },
});
