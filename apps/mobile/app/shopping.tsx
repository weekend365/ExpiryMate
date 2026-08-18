import { COUPANG_PARTNERS_DISCLOSURE } from "@expirymate/shared";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Search, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
import { JangoHeroNoticeCarousel } from "../src/components/JangoHeroNoticeCarousel";
import { Screen } from "../src/components/Screen";
import { AffiliateProductGroupView } from "../src/features/affiliate/affiliate-product-group";
import {
  getShoppingHeroNotices,
  isShoppingSearchActive,
} from "../src/features/affiliate/shopping-hero";
import {
  advanceRecentShoppingOffset,
  canRotateRecentShoppingGroups,
  pickRecentShoppingGroups,
  recentShoppingRotationNotice,
} from "../src/features/affiliate/shopping-recent-rotation";
import { useAffiliateShopping } from "../src/features/affiliate/use-affiliate-shopping";
import { useActiveSpace } from "../src/features/spaces/space-provider";
import {
  searchAffiliateProducts,
  trackMonetizationEvent,
} from "../src/services/api";
import { useResponsiveLayout } from "../src/shared/responsive-layout";
import { colors, radius, spacing, touchTarget, typography } from "../src/shared/theme";

export default function ShoppingScreen() {
  const { activeSpaceId } = useActiveSpace();
  const shoppingQuery = useAffiliateShopping();
  const [query, setQuery] = useState("");
  const [recentOffset, setRecentOffset] = useState(0);
  const [rotationNotice, setRotationNotice] = useState<string | null>(null);
  const [rotationNoticeTick, setRotationNoticeTick] = useState(0);
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
  const allRecentGroups = (shopping?.productGroups ?? []).filter(
    (group) => group.products.length > 0,
  );
  const recentGroups = pickRecentShoppingGroups(allRecentGroups, recentOffset);
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
  const heroNotices = getShoppingHeroNotices({
    isSearching: searchMutation.isPending,
    hasSearchError: searchMutation.isError,
    hasSearchResults: Boolean(searchGroup),
    searchWasEmpty: Boolean(searchMutation.isSuccess && !searchGroup),
    isShoppingLoading: shoppingQuery.isLoading || isRefreshingRecent,
    isShoppingError: shoppingQuery.isError && !isRefreshingRecent,
    isShoppingEnabled: shopping?.enabled !== false,
    hasRecentGroups: recentGroups.length > 0,
    rotationNotice: searchActive ? null : rotationNotice,
  });
  useEffect(() => {
    setRecentOffset(0);
    setRotationNotice(null);
  }, [activeSpaceId, shoppingQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!rotationNotice) return;
    const timer = setTimeout(() => setRotationNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [rotationNotice, rotationNoticeTick]);

  const refreshRecentItems = () => {
    setRecentOffset(0);
    setRotationNotice(null);
    void shoppingQuery.refetch();
  };
  const rotateRecentItems = () => {
    if (!canRotateRecentShoppingGroups(allRecentGroups.length)) {
      const notice = recentShoppingRotationNotice(allRecentGroups.length);
      setRotationNotice(notice);
      setRotationNoticeTick((tick) => tick + 1);
      AccessibilityInfo.announceForAccessibility(notice);
      return;
    }
    setRotationNotice(null);
    setRecentOffset((offset) =>
      advanceRecentShoppingOffset(offset, allRecentGroups.length),
    );
  };
  const clearSearch = () => {
    setQuery("");
    searchMutation.reset();
  };
  const { shouldStackDense } = useResponsiveLayout();

  return (
    <Screen
      density="compact"
      topInsetMode="none"
      contentWidth="wide"
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
        <JangoHeroNoticeCarousel notices={heroNotices} />
        <View
          style={[
            styles.searchBar,
            shouldStackDense && styles.searchBarStacked,
          ]}
        >
          <View style={styles.searchField}>
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
          </View>
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
              shouldStackDense && styles.searchSubmitStacked,
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
          count={searchGroup ? 1 : undefined}
          testID="affiliate-shopping-search-results"
        >
          {searchMutation.isPending ? (
            <ShoppingCatalogSkeleton label="상품을 찾아보고 있어요" />
          ) : searchGroup ? (
            <ShoppingIngredientCard>
              <AffiliateProductGroupView group={searchGroup} />
            </ShoppingIngredientCard>
          ) : null}
        </ShoppingCatalogSection>
      ) : (
        <ShoppingCatalogSection
          title="최근 다 쓴 재료"
          count={
            !shoppingQuery.isLoading &&
            !shoppingQuery.isError &&
            shopping?.enabled !== false &&
            recentGroups.length > 0
              ? recentGroups.length
              : undefined
          }
          headerAction={
            <Pressable
              onPress={rotateRecentItems}
              accessibilityRole="button"
              accessibilityLabel="새로고침"
              accessibilityHint="지금 보이는 재료를 빼고 다른 최근 재료를 보여 줘요."
              testID="affiliate-shopping-refresh-button"
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.sectionAction,
                pressed && styles.sectionActionPressed,
              ]}
            >
              <AppText
                variant="bodySmall"
                scaleRole="chrome"
                densityAware={false}
                numberOfLines={1}
              >
                새로고침
              </AppText>
              <RefreshCw
                color={colors.text}
                size={typography.bodySmall.fontSize}
                strokeWidth={2.4}
              />
            </Pressable>
          }
          testID="affiliate-shopping-recent"
        >
          {shoppingQuery.isLoading ? (
            <ShoppingCatalogSkeleton label="최근 소비 상품을 불러오고 있어요" />
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
            <View style={styles.empty}>
              <AppText variant="bodySmall" tone="subtext">
                장보기 기능을 준비하고 있어요.
              </AppText>
            </View>
          ) : recentGroups.length === 0 ? (
            <View style={styles.empty}>
              <AppText variant="caption" tone="subtext">
                아직 없어요. 위 검색창에서 찾아볼 수 있어요.
              </AppText>
            </View>
          ) : (
            recentGroups.map((group) => (
              <ShoppingIngredientCard
                key={`${group.placement}:${group.query}:${group.ingredientName}`}
              >
                <AffiliateProductGroupView group={group} />
              </ShoppingIngredientCard>
            ))
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
  count,
  headerAction,
  children,
  testID,
}: {
  title: string;
  count?: number;
  headerAction?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const { isRegular } = useResponsiveLayout();
  const heading = count == null ? title : `${title} ${count}건`;
  return (
    <View style={styles.section} testID={testID}>
      <View
        style={[styles.sectionHeader, styles.sectionHeaderExpanded]}
        accessibilityRole="header"
        accessibilityLabel={heading}
      >
        <AppText
          variant="bodySmall"
          scaleRole="chrome"
          densityAware={false}
          numberOfLines={1}
          style={styles.sectionTitle}
        >
          {heading}
        </AppText>
        {headerAction}
      </View>
      <View
        style={[styles.sectionBody, isRegular && styles.sectionBodyRegular]}
      >
        {children}
      </View>
    </View>
  );
}

function ShoppingIngredientCard({
  children,
}: {
  children: ReactNode;
}) {
  const { isRegular } = useResponsiveLayout();
  return (
    <View style={[styles.itemCard, isRegular && styles.itemCardRegular]}>
      {children}
    </View>
  );
}

function ShoppingCatalogSkeleton({ label }: { label: string }) {
  const { isRegular } = useResponsiveLayout();
  return (
    <View
      style={[
        styles.loadingSkeleton,
        isRegular && styles.loadingSkeletonRegular,
      ]}
      accessibilityLabel={label}
    >
      <ShoppingIngredientCard>
        <View style={styles.skeletonRow}>
          <SkeletonBlock height={spacing.xxl * 2} width={spacing.xxl * 2} radiusToken="md" />
          <View style={styles.skeletonCopy}>
            <SkeletonBlock height={spacing.sm} width="88%" />
            <SkeletonBlock height={spacing.sm} width="42%" />
          </View>
        </View>
      </ShoppingIngredientCard>
      <ShoppingIngredientCard>
        <View style={styles.skeletonRow}>
          <SkeletonBlock height={spacing.xxl * 2} width={spacing.xxl * 2} radiusToken="md" />
          <View style={styles.skeletonCopy}>
            <SkeletonBlock height={spacing.sm} width="76%" />
            <SkeletonBlock height={spacing.sm} width="36%" />
          </View>
        </View>
      </ShoppingIngredientCard>
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
  searchBarStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: spacing.xxs,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  searchSubmitStacked: {
    alignSelf: "stretch",
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
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  sectionHeader: {
    minHeight: touchTarget.min,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  sectionAction: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
  },
  sectionActionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  sectionBody: {
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.mutedSurface,
  },
  sectionBodyRegular: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: "hidden",
  },
  itemCardRegular: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
  },
  legal: {
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  legalText: {
    textAlign: "center",
  },
  loadingSkeleton: {
    width: "100%",
    flexBasis: "100%",
    gap: spacing.xs,
  },
  loadingSkeletonRegular: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
    width: "100%",
    flexBasis: "100%",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
