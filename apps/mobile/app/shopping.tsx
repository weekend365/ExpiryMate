import { COUPANG_PARTNERS_DISCLOSURE } from "@expirymate/shared";
import { useMutation } from "@tanstack/react-query";
import { Search, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "../src/components/AppText";
import { AppTextInput } from "../src/components/AppTextInput";
import { Button } from "../src/components/Button";
import { SkeletonBlock } from "../src/components/ContentSkeleton";
import { MascotSpeechBubble } from "../src/components/MascotSpeechBubble";
import { Screen } from "../src/components/Screen";
import { AffiliateProductGroupView } from "../src/features/affiliate/affiliate-product-group";
import {
  getShoppingHeroNotice,
  isShoppingSearchActive,
} from "../src/features/affiliate/shopping-hero";
import { useAffiliateShopping } from "../src/features/affiliate/use-affiliate-shopping";
import { useActiveSpace } from "../src/features/spaces/space-provider";
import {
  searchAffiliateProducts,
  trackMonetizationEvent,
} from "../src/services/api";
import { colors, radius, spacing, touchTarget } from "../src/shared/theme";

export default function ShoppingScreen() {
  const { activeSpaceId } = useActiveSpace();
  const shoppingQuery = useAffiliateShopping();
  const [query, setQuery] = useState("");
  const trackedOpened = useRef(false);
  const searchMutation = useMutation({
    mutationFn: async (value: string) => {
      if (!activeSpaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return searchAffiliateProducts(
        { query: value, placement: "shopping_search" },
        activeSpaceId,
      );
    },
  });

  useEffect(() => {
    if (trackedOpened.current) return;
    trackedOpened.current = true;
    void trackMonetizationEvent({
      event: "affiliate_shopping_opened",
      properties: { source: "home_or_context" },
    }).catch(() => undefined);
  }, []);

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || searchMutation.isPending) return;
    searchMutation.reset();
    searchMutation.mutate(trimmed);
  };
  const shopping = shoppingQuery.data;
  const recentGroups = (shopping?.productGroups ?? []).filter(
    (group) => group.products.length > 0,
  );
  const searchGroup =
    searchMutation.data?.group && searchMutation.data.group.products.length > 0
      ? searchMutation.data.group
      : null;
  const isRefreshingRecent =
    shoppingQuery.isRefetching && !shoppingQuery.isLoading;
  const searchActive = isShoppingSearchActive({
    isSearching: searchMutation.isPending,
    hasSearchResults: Boolean(searchGroup),
  });
  const canClearSearch =
    query.length > 0 || searchMutation.status !== "idle";
  const hero = getShoppingHeroNotice({
    isSearching: searchMutation.isPending,
    hasSearchError: searchMutation.isError,
    hasSearchResults: Boolean(searchGroup),
    searchWasEmpty: Boolean(searchMutation.isSuccess && !searchGroup),
    isShoppingLoading: shoppingQuery.isLoading || isRefreshingRecent,
    isShoppingError: shoppingQuery.isError && !isRefreshingRecent,
    isShoppingEnabled: shopping?.enabled !== false,
    hasRecentGroups: recentGroups.length > 0,
  });
  const refreshRecentItems = () => {
    void shoppingQuery.refetch();
  };
  const clearSearch = () => {
    setQuery("");
    searchMutation.reset();
  };

  return (
    <Screen
      density="compact"
      topInsetMode="none"
      testID="affiliate-shopping-screen"
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={isRefreshingRecent}
          onRefresh={refreshRecentItems}
        />
      }
    >
      <View style={styles.heroCard}>
        <MascotSpeechBubble
          message={hero.message}
          mood={hero.mood}
          size="small"
        />
        <View style={styles.searchBar}>
          <Search
            color={colors.mutedText}
            size={spacing.sm}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="예: 대파, 달걀, 밀폐용기"
            accessibilityLabel="식재료 검색"
            style={styles.searchInput}
          />
          {canClearSearch ? (
            <Pressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="검색 지우기"
              testID="affiliate-shopping-clear-button"
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.searchClear,
                pressed && styles.searchSubmitPressed,
              ]}
            >
              <X
                color={colors.mutedText}
                size={spacing.sm}
                strokeWidth={2.4}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={submitSearch}
            disabled={!query.trim() || searchMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="검색"
            accessibilityState={{
              disabled: !query.trim() || searchMutation.isPending,
              busy: searchMutation.isPending,
            }}
            testID="affiliate-shopping-search-button"
            hitSlop={spacing.xs}
            style={({ pressed }) => [
              styles.searchSubmit,
              pressed && query.trim() ? styles.searchSubmitPressed : null,
            ]}
          >
            {searchMutation.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <AppText
                variant="bodyStrong"
                tone={query.trim() ? "primary" : "muted"}
                scaleRole="chrome"
                densityAware={false}
              >
                검색
              </AppText>
            )}
          </Pressable>
        </View>
      </View>

      {searchActive ? (
        <ShoppingCatalogSection
          title="검색 결과"
          testID="affiliate-shopping-search-results"
        >
          {searchMutation.isPending ? (
            <View style={styles.sectionSurface}>
              <ShoppingCatalogSkeleton label="상품을 찾아보고 있어요" />
            </View>
          ) : searchGroup ? (
            <View style={styles.sectionSurface}>
              <AffiliateProductGroupView group={searchGroup} />
            </View>
          ) : null}
        </ShoppingCatalogSection>
      ) : (
        <ShoppingCatalogSection
          title="최근 다 쓴 재료"
          testID="affiliate-shopping-recent"
        >
          {shoppingQuery.isLoading ? (
            <View style={styles.sectionSurface}>
              <ShoppingCatalogSkeleton label="최근 소비 상품을 불러오고 있어요" />
            </View>
          ) : shoppingQuery.isError ? (
            <View style={styles.empty}>
              <AppText variant="bodySmall" tone="subtext">
                불러오지 못했어요.
              </AppText>
              <Button variant="secondary" size="small" onPress={refreshRecentItems}>
                다시 시도
              </Button>
            </View>
          ) : !shopping?.enabled ? (
            <AppText variant="bodySmall" tone="subtext">
              장보기 기능을 준비하고 있어요.
            </AppText>
          ) : recentGroups.length === 0 ? (
            <AppText variant="caption" tone="subtext">
              아직 없어요. 위 검색창에서 찾아볼 수 있어요.
            </AppText>
          ) : (
            <View style={styles.groups}>
              {recentGroups.map((group) => (
                <View
                  key={`${group.placement}:${group.query}:${group.ingredientName}`}
                  style={styles.sectionSurface}
                >
                  <AffiliateProductGroupView group={group} />
                </View>
              ))}
            </View>
          )}
        </ShoppingCatalogSection>
      )}

      <View style={styles.legal}>
        <AppText variant="caption" tone="muted" style={styles.legalText}>
          {shopping?.disclosure ?? COUPANG_PARTNERS_DISCLOSURE}
        </AppText>
        <AppText variant="caption" tone="muted" style={styles.legalText}>
          상품 가격과 배송 정보는 쿠팡에서 변경될 수 있으며, 결제와 배송은 쿠팡에서 처리됩니다.
        </AppText>
      </View>
    </Screen>
  );
}

function ShoppingCatalogSection({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="label" tone="subtext" numberOfLines={1}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function ShoppingCatalogSkeleton({ label }: { label: string }) {
  return (
    <View style={styles.loadingSkeleton} accessibilityLabel={label}>
      <View style={styles.skeletonRow}>
        <SkeletonBlock height={spacing.xxl * 2} width={spacing.xxl * 2} radiusToken="md" />
        <View style={styles.skeletonCopy}>
          <SkeletonBlock height={spacing.sm} width="88%" />
          <SkeletonBlock height={spacing.sm} width="42%" />
        </View>
      </View>
      <View style={styles.skeletonRow}>
        <SkeletonBlock height={spacing.xxl * 2} width={spacing.xxl * 2} radiusToken="md" />
        <View style={styles.skeletonCopy}>
          <SkeletonBlock height={spacing.sm} width="76%" />
          <SkeletonBlock height={spacing.sm} width="36%" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xxs,
  },
  searchInput: {
    flex: 1,
    minHeight: touchTarget.min,
  },
  searchSubmit: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
  },
  searchSubmitPressed: {
    backgroundColor: colors.surfacePressed,
  },
  searchClear: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  section: {
    gap: spacing.xs,
  },
  sectionSurface: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  groups: { gap: spacing.sm },
  legal: {
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  legalText: {
    textAlign: "center",
  },
  loadingSkeleton: {
    gap: spacing.xs,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  skeletonCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  empty: {
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
