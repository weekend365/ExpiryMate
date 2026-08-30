import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ChevronDown, History, Search, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type TextInput,
} from "react-native";
import { AppText } from "../src/components/AppText";
import { AppTextInput } from "../src/components/AppTextInput";
import { Button } from "../src/components/Button";
import { SkeletonBlock } from "../src/components/ContentSkeleton";
import { JangoHeroNoticeCarousel } from "../src/components/JangoHeroNoticeCarousel";
import { Screen } from "../src/components/Screen";
import { AffiliateProductGroupView } from "../src/features/affiliate/affiliate-product-group";
import { AffiliateDisclosure } from "../src/features/affiliate/affiliate-disclosure";
import {
  getShoppingHeroNotices,
  initialShoppingQuery,
  isShoppingSearchActive,
} from "../src/features/affiliate/shopping-hero";
import {
  SHOPPING_RECENT_PAGE_SIZE,
  canLoadMoreRecentShopping,
  nextRecentShoppingVisibleCount,
  resolveRecentShoppingCount,
  takeRecentShoppingGroups,
} from "../src/features/affiliate/shopping-recent-rotation";
import { parseShoppingEntryContext } from "../src/features/affiliate/shopping-entry-context";
import { useAffiliateShopping } from "../src/features/affiliate/use-affiliate-shopping";
import { useActiveSpace } from "../src/features/spaces/space-provider";
import {
  searchAffiliateProducts,
  trackMonetizationEvent,
} from "../src/services/api";
import { useResponsiveLayout } from "../src/shared/responsive-layout";
import { colors, radius, spacing, touchTarget } from "../src/shared/theme";

export default function ShoppingScreen({
  inTabs = false,
}: {
  inTabs?: boolean;
}) {
  const { activeSpaceId } = useActiveSpace();
  const shoppingQuery = useAffiliateShopping();
  const params = useLocalSearchParams<{
    q?: string | string[];
    items?: string | string[];
    source?: string | string[];
  }>();
  const queryParam = params.q;
  const itemsParam = params.items;
  const sourceParam = params.source;
  const entryContext = useMemo(
    () =>
      parseShoppingEntryContext({
        q: queryParam,
        items: itemsParam,
        source: sourceParam,
      }),
    [itemsParam, queryParam, sourceParam],
  );
  const incomingKey = JSON.stringify(entryContext);
  const incomingQuery =
    entryContext.queries[0] ?? initialShoppingQuery(queryParam);
  const [query, setQuery] = useState(incomingQuery);
  const [recentVisibleCount, setRecentVisibleCount] = useState(
    SHOPPING_RECENT_PAGE_SIZE,
  );
  const trackedOpened = useRef<string | null>(null);
  const appliedIncomingQuery = useRef<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchMutation = useMutation({
    mutationFn: async (input: {
      queries: string[];
      placement: typeof entryContext.placement;
    }) => {
      if (!activeSpaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return Promise.all(
        input.queries.map((value) =>
          searchAffiliateProducts(
            { query: value, placement: input.placement },
            activeSpaceId,
          ),
        ),
      );
    },
  });

  useEffect(() => {
    if (trackedOpened.current === incomingKey) return;
    trackedOpened.current = incomingKey;
    void trackMonetizationEvent({
      event: "affiliate_shopping_opened",
      properties: { source: entryContext.source.slice(0, 120) },
    }).catch(() => undefined);
  }, [entryContext.source, incomingKey]);

  useEffect(() => {
    if (!entryContext.queries.length || !activeSpaceId) {
      return;
    }
    if (appliedIncomingQuery.current === incomingKey) {
      return;
    }
    appliedIncomingQuery.current = incomingKey;
    setQuery(incomingQuery);
    searchMutation.reset();
    searchMutation.mutate({
      queries: entryContext.queries,
      placement: entryContext.placement,
    });
  }, [
    activeSpaceId,
    entryContext.placement,
    entryContext.queries,
    incomingKey,
    incomingQuery,
    searchMutation,
  ]);

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || searchMutation.isPending) return;
    searchMutation.reset();
    searchMutation.mutate({
      queries: [trimmed],
      placement: "shopping_search",
    });
  };
  const shopping = shoppingQuery.data;
  const allRecentGroups = (shopping?.productGroups ?? []).filter(
    (group) => group.products.length > 0,
  );
  const recentGroups = takeRecentShoppingGroups(
    allRecentGroups,
    recentVisibleCount,
  );
  const searchGroups = (searchMutation.data ?? []).flatMap((response) =>
    response.group && response.group.products.length > 0 ? [response.group] : [],
  );
  const isRefreshingRecent =
    shoppingQuery.isRefetching && !shoppingQuery.isLoading;
  const searchActive = isShoppingSearchActive(searchMutation.status);
  const canClearSearch =
    query.length > 0 || searchMutation.status !== "idle";
  const canLoadMoreRecent = canLoadMoreRecentShopping(
    recentGroups.length,
    allRecentGroups.length,
  );
  const nextRecentBatchSize =
    nextRecentShoppingVisibleCount(
      allRecentGroups.length,
    ) - recentGroups.length;
  const recentResolvedCount = resolveRecentShoppingCount(
    shopping?.recentResolvedCount ?? shopping?.recentConsumedCount,
    allRecentGroups.length,
  );
  const heroNotices = getShoppingHeroNotices({
    isSearching: searchMutation.isPending,
    hasSearchError: searchMutation.isError,
    hasSearchResults: searchGroups.length > 0,
    searchWasEmpty: Boolean(searchMutation.isSuccess && !searchGroups.length),
    isShoppingLoading: shoppingQuery.isLoading || isRefreshingRecent,
    isShoppingError: shoppingQuery.isError && !isRefreshingRecent,
    isShoppingEnabled: shopping?.enabled !== false,
    hasRecentGroups: recentGroups.length > 0,
  });
  useEffect(() => {
    setRecentVisibleCount(SHOPPING_RECENT_PAGE_SIZE);
  }, [activeSpaceId, shoppingQuery.dataUpdatedAt]);

  const refreshRecentItems = () => {
    setRecentVisibleCount(SHOPPING_RECENT_PAGE_SIZE);
    void shoppingQuery.refetch();
  };
  const loadMoreRecentItems = () => {
    setRecentVisibleCount(
      nextRecentShoppingVisibleCount(allRecentGroups.length),
    );
  };
  const clearSearch = () => {
    setQuery("");
    searchMutation.reset();
  };
  const searchSectionTitle = searchMutation.variables?.queries.length
    ? searchMutation.variables.queries.length > 1
      ? `오늘 필요한 재료 ${searchMutation.variables.queries.length}개`
      : `‘${searchMutation.variables.queries[0]}’ 검색 결과`
    : "검색 결과";
  const { shouldStackDense } = useResponsiveLayout();

  return (
    <Screen
      density="compact"
      topInsetMode={inTabs ? "safe" : "none"}
      bottomInsetMode={inTabs ? "navigator" : "system"}
      contentWidth="wide"
      testID="affiliate-shopping-screen"
      refreshControl={
        <RefreshControl
          tintColor={colors.linkText}
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
          <Pressable
            accessible={false}
            onPress={() => searchInputRef.current?.focus()}
            style={[
              styles.searchField,
              shouldStackDense && styles.searchFieldStacked,
            ]}
          >
            <Search
              color={colors.mutedText}
              size={spacing.sm}
              strokeWidth={2.4}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <AppTextInput
              ref={searchInputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              placeholder="예: 대파, 달걀, 밀폐용기"
              accessibilityLabel="식재료 검색"
              variant="bodyStrong"
              scaleRole="chrome"
              textAlignVertical="center"
              underlineColorAndroid="transparent"
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
          </Pressable>
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
              <ActivityIndicator color={colors.linkText} />
            ) : (
              <AppText
                variant="bodyStrong"
                tone={query.trim() ? "link" : "muted"}
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
          title={searchSectionTitle}
          count={searchGroups.reduce(
            (sum, group) => sum + group.products.length,
            0,
          )}
          onBackToRecent={clearSearch}
          testID="affiliate-shopping-search-results"
        >
          {searchMutation.isPending ? (
            <ShoppingCatalogSkeleton label="상품을 찾아보고 있어요" />
          ) : searchGroups.length ? (
            <>
              {searchGroups.map((group, index) => (
                <ShoppingIngredientCard
                  key={`${group.placement}:${group.query}`}
                  showDivider={index < searchGroups.length - 1}
                >
                  <AffiliateProductGroupView headingBand group={group} />
                </ShoppingIngredientCard>
              ))}
            </>
          ) : searchMutation.isError ? (
            <View style={styles.empty}>
              <AppText variant="bodySmall" tone="subtext">
                상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </AppText>
              <Button variant="secondary" size="small" onPress={submitSearch}>
                다시 검색
              </Button>
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="bodySmall" tone="subtext">
                일치하는 상품이 없어요. 다른 재료 이름으로 찾아보세요.
              </AppText>
              <Button
                variant="secondary"
                size="small"
                onPress={() => searchInputRef.current?.focus()}
              >
                검색어 바꾸기
              </Button>
            </View>
          )}
        </ShoppingCatalogSection>
      ) : (
        <ShoppingCatalogSection
          title="최근 다 쓴 재료"
          count={
            !shoppingQuery.isLoading &&
            !shoppingQuery.isError &&
            shopping &&
            shopping.enabled !== false
              ? recentResolvedCount
              : undefined
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
            <>
              {recentGroups.map((group, index) => (
                <ShoppingIngredientCard
                  key={`${group.placement}:${group.query}:${group.ingredientName}`}
                  showDivider={
                    index < recentGroups.length - 1 || canLoadMoreRecent
                  }
                >
                  <AffiliateProductGroupView headingBand group={group} />
                </ShoppingIngredientCard>
              ))}
              {canLoadMoreRecent ? (
                <Pressable
                  onPress={loadMoreRecentItems}
                  accessibilityRole="button"
                  accessibilityLabel="더 보기"
                  accessibilityHint={`최근 다 쓴 재료를 ${nextRecentBatchSize}건 더 보여 줘요.`}
                  testID="affiliate-shopping-load-more"
                  style={({ pressed }) => [
                    styles.loadMore,
                    pressed && styles.loadMorePressed,
                  ]}
                >
                  <AppText
                    variant="bodySmall"
                    tone="subtext"
                    scaleRole="chrome"
                    densityAware={false}
                  >
                    더 보기
                  </AppText>
                  <ChevronDown
                    color={colors.subtext}
                    size={spacing.sm}
                    strokeWidth={2.4}
                  />
                </Pressable>
              ) : null}
            </>
          )}
        </ShoppingCatalogSection>
      )}

      <AffiliateDisclosure
        disclosure={shopping?.disclosure}
        supportingText="상품 가격과 배송 정보는 쿠팡에서 변경될 수 있으며, 결제와 배송은 쿠팡에서 처리됩니다."
      />

    </Screen>
  );
}

function ShoppingCatalogSection({
  title,
  count,
  children,
  onBackToRecent,
  testID,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  onBackToRecent?: () => void;
  testID?: string;
}) {
  const heading = count == null ? title : `${title} ${count}건`;
  return (
    <View style={styles.section} testID={testID}>
      <View
        style={[styles.sectionHeader, styles.sectionHeaderExpanded]}
        accessibilityRole="header"
        accessibilityLabel={heading}
      >
        <View style={styles.sectionHeading}>
          <AppText
            variant="bodySmall"
            scaleRole="chrome"
            densityAware={false}
            numberOfLines={1}
            style={styles.sectionTitle}
          >
            {title}
          </AppText>
          {count == null ? null : (
            <AppText
              variant="bodySmall"
              scaleRole="chrome"
              densityAware={false}
              style={styles.sectionCount}
            >
              {count}건
            </AppText>
          )}
        </View>
        {onBackToRecent ? (
          <Pressable
            onPress={onBackToRecent}
            accessibilityRole="button"
            accessibilityLabel="최근 재료로 돌아가기"
            style={({ pressed }) => [
              styles.recentReturn,
              pressed && styles.searchSubmitPressed,
            ]}
          >
            <History
              color={colors.linkText}
              size={spacing.sm}
              strokeWidth={2.4}
            />
            <AppText
              variant="captionStrong"
              tone="link"
              scaleRole="chrome"
              densityAware={false}
              numberOfLines={1}
            >
              최근 재료
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ShoppingIngredientCard({
  children,
  showDivider = false,
}: {
  children: ReactNode;
  showDivider?: boolean;
}) {
  return (
    <View style={[styles.itemCard, showDivider && styles.itemCardDivider]}>
      {children}
    </View>
  );
}

function ShoppingCatalogSkeleton({ label }: { label: string }) {
  return (
    <View style={styles.loadingSkeleton} accessibilityLabel={label}>
      <ShoppingIngredientCard showDivider>
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
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  searchFieldStacked: {
    flexGrow: 0,
    alignSelf: "stretch",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    margin: spacing.none,
    // Keep the field intrinsic-height so the row centers it with the icon
    // and 검색 label. A 48px-tall TextInput leaves iOS placeholder off-center.
    paddingVertical: spacing.none,
    paddingHorizontal: spacing.none,
    textAlignVertical: "center",
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionHeading: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  sectionTitle: {
    flexShrink: 1,
  },
  sectionCount: {
    flexShrink: 0,
  },
  recentReturn: {
    minHeight: touchTarget.icon,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xs,
  },
  sectionBody: {
    backgroundColor: colors.surface,
  },
  itemCard: {
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  itemCardDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  loadMore: {
    width: "100%",
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    backgroundColor: colors.surface,
  },
  loadMorePressed: {
    backgroundColor: colors.surfacePressed,
  },
  loadingSkeleton: {
    width: "100%",
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
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
