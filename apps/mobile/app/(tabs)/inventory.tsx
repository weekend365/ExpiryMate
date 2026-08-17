import {
  getExpiryTrafficBucket,
  isTrackedItem,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  Barcode,
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  MapPin,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  ImageBackground,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import fridgeInteriorBg from "../../assets/backgrounds/fridge-interior-bg.png";
import { AppText } from "../../src/components/AppText";
import { AppTextInput } from "../../src/components/AppTextInput";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import {
  HomeStatsSkeleton,
  InventoryListSkeleton,
} from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryCleanupSheet } from "../../src/components/InventoryCleanupSheet";
import { InventoryCard } from "../../src/components/InventoryCard";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { Screen } from "../../src/components/Screen";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import { StatCard } from "../../src/components/StatCard";
import {
  buildInventoryFacetCounts,
  buildInventoryUrgencySections,
  filterInventoryItems,
  inventoryUrgencySectionDescriptions,
  parseInventoryViewFilter,
  type InventoryUrgencySection,
  type InventoryViewFilter,
} from "../../src/features/inventory/filters";
import { getInventoryHeroNotice } from "../../src/features/inventory/inventory-hero";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import { useDeferredInventoryItemRemoval } from "../../src/features/inventory/use-deferred-inventory-item-removal";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { useStorageLocations } from "../../src/features/settings/use-storage-locations";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { useRegistrationStore } from "../../src/store/registration-store";

const urgencySectionTones: Record<
  InventoryUrgencySection,
  "danger" | "warning" | "success"
> = {
  expired: "danger",
  within7: "warning",
  safe: "success",
};

const inventoryHeroToolbarFills = {
  danger: colors.dangerSoft,
  warning: colors.warningSoft,
  success: colors.successSoft,
  neutral: colors.mutedSurface,
} as const;

export default function InventoryScreen() {
  const { shouldStack, shouldStackDense } = useResponsiveLayout();
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const filterParam = parseInventoryViewFilter(params.filter);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useInventoryList();
  const batchDiscardMutation = useBatchDiscardInventoryItems();
  const deferredRemoval = useDeferredInventoryItemRemoval();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const { selectableOptions, resolveLabel } = useStorageLocations();
  const [filter, setFilter] = useState<InventoryViewFilter>(
    () => filterParam ?? "all",
  );
  const [location, setLocation] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [entryMethodVisible, setEntryMethodVisible] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [collapsedSectionKeys, setCollapsedSectionKeys] = useState<
    InventoryUrgencySection[]
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cleanupItem, setCleanupItem] = useState<InventoryItem | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [filterParam]);

  useEffect(() => {
    const keys = new Set(selectableOptions.map((option) => option.key));

    if (location !== "all" && !keys.has(location)) {
      setLocation("all");
    }
  }, [location, selectableOptions]);

  const applyFilter = (nextFilter: InventoryViewFilter) => {
    setFilter(nextFilter);
    router.setParams({
      filter: nextFilter === "all" ? undefined : nextFilter,
    });
  };

  const toggleExpiryFilter = (
    nextFilter: Exclude<InventoryViewFilter, "all">,
  ) => {
    applyFilter(filter === nextFilter ? "all" : nextFilter);
  };

  const hasLoadedInventory = data !== undefined;
  const loadErrorMessage =
    error instanceof Error
      ? error.message
      : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

  const trackedItems = useMemo(
    () => (data ?? []).filter(isTrackedItem),
    [data],
  );

  const filtered = useMemo(
    () => filterInventoryItems(trackedItems, filter, location, searchQuery),
    [trackedItems, filter, location, searchQuery],
  );
  const urgencySections = useMemo(
    () => buildInventoryUrgencySections(filtered),
    [filtered],
  );
  const collapsedSectionKeySet = useMemo(
    () => new Set(collapsedSectionKeys),
    [collapsedSectionKeys],
  );
  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const expiredVisibleIds = useMemo(
    () =>
      filtered
        .filter((item) => getExpiryTrafficBucket(item.expiryDate) === "expired")
        .map((item) => item.id),
    [filtered],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allExpiredVisibleSelected =
    expiredVisibleIds.length > 0 &&
    expiredVisibleIds.every((id) => selectedIdSet.has(id));
  const facetCounts = useMemo(
    () =>
      buildInventoryFacetCounts(trackedItems, filter, location, searchQuery),
    [trackedItems, filter, location, searchQuery],
  );

  const hasLocationFilter = location !== "all";
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasStatusFilter = filter !== "all";
  const hasActiveFilters =
    hasLocationFilter || hasSearchQuery || hasStatusFilter;
  const selectedLocationLabel =
    location === "all" ? "모든 위치" : resolveLabel(location);

  const selectLocationFilter = (next: string | "all") => {
    setLocation(next);
    setFilterSheetVisible(false);
  };

  const openLocationFilterSheet = () => {
    setFilterSheetVisible(true);
  };

  // Only treat as empty after a successful load — never during loading/error.
  const isEmptyInventory =
    hasLoadedInventory && !isError && trackedItems.length === 0;
  const isFilteredEmpty = !isEmptyInventory && filtered.length === 0;
  const showListChrome = hasLoadedInventory && !isError && !isEmptyInventory;
  const heroNotice = useMemo(
    () =>
      getInventoryHeroNotice({
        isInitialLoading: isLoading && !hasLoadedInventory,
        isInitialError: isError && !hasLoadedInventory,
        isSelectionMode,
        totalCount: trackedItems.length,
        visibleCount: filtered.length,
        expiredCount: facetCounts.status.expired,
        within7Count: facetCounts.status.within7,
        statusFilter: filter,
      }),
    [
      facetCounts.status.expired,
      facetCounts.status.within7,
      filter,
      filtered.length,
      hasLoadedInventory,
      isError,
      isLoading,
      isSelectionMode,
      trackedItems.length,
    ],
  );
  const inventoryHeroBubble = heroNotice.show ? (
    <MascotSpeechBubble
      message={heroNotice.message}
      supportingMessage={heroNotice.supportingMessage}
      mood={heroNotice.mood}
      size="small"
      density="compact"
      style={styles.heroBubble}
    />
  ) : null;

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);

    setSelectedIds((current) => {
      const nextIds = current.filter((id) => visibleIdSet.has(id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [visibleIds]);

  useEffect(() => {
    const visibleKeys = new Set(urgencySections.map((section) => section.key));

    setCollapsedSectionKeys((current) => {
      const next = current.filter((key) => visibleKeys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [urgencySections]);

  const openEntryMethodSheet = () => {
    setEntryMethodVisible(true);
  };

  const goToManualRegister = () => {
    setEntryMethodVisible(false);
    clearPrefill();
    router.push("/register");
  };

  const goToScanner = () => {
    setEntryMethodVisible(false);
    clearPrefill();
    router.push("/scanner");
  };

  const clearListFilters = () => {
    if (filter !== "all") {
      applyFilter("all");
    }
    if (hasLocationFilter) {
      setLocation("all");
    }
    if (hasSearchQuery) {
      setSearchQuery("");
    }
  };

  const enterSelectionMode = (initialId?: string) => {
    setFilterSheetVisible(false);
    setIsSelectionMode(true);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.clearError();
    setSelectedIds(initialId ? [initialId] : []);
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
    setActionErrorMessage(null);
  };

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const handleToggleAllExpiredVisible = () => {
    if (allExpiredVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !expiredVisibleIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([...current, ...expiredVisibleIds]),
    ]);
  };

  const openCleanupSheet = (item: InventoryItem) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.clearError();
    setCleanupItem(item);
  };

  const handleCardPress = (item: InventoryItem) => {
    if (isSelectionMode) {
      toggleSelectedId(item.id);
      return;
    }

    openCleanupSheet(item);
  };

  const handleEditItem = (item: InventoryItem) => {
    router.push({
      pathname: "/inventory/[id]",
      params: { id: item.id, mode: "edit" },
    });
  };

  const handleCardLongPress = (id: string) => {
    enterSelectionMode(id);
  };

  const toggleSectionCollapsed = (key: InventoryUrgencySection) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setCollapsedSectionKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const handleConfirmBatchDiscard = () => {
    if (!selectedIds.length || batchDiscardMutation.isPending) {
      return;
    }

    const idsToDiscard = [...selectedIds];

    // Optimistic: leave selection mode immediately so the next pick feels instant.
    setActionErrorMessage(null);
    deferredRemoval.clearError();
    setSelectedIds([]);
    setIsSelectionMode(false);
    setSuccessMessage(
      `${idsToDiscard.length}개 재료를 정리했어요. 장고도 한숨 돌렸어요.`,
    );

    void batchDiscardMutation.mutateAsync(idsToDiscard).catch((error) => {
      setSuccessMessage(null);
      setActionErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    });
  };

  const handleConsumeAll = (item: InventoryItem) => {
    setCleanupItem(null);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.scheduleRemoval(item, "consume");
  };

  const handleConsumePartial = (item: InventoryItem, amountBase: number) => {
    setCleanupItem(null);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.scheduleRemoval(item, "consume", amountBase);
  };

  const primaryFooter =
    !showListChrome || isFilteredEmpty ? null : isSelectionMode ? (
      <Button
        variant="danger"
        icon={Trash2}
        onPress={handleConfirmBatchDiscard}
        loading={batchDiscardMutation.isPending}
        disabled={!selectedIds.length}
        fullWidth
        testID="inventory-discard-selected-button"
      >
        {selectedIds.length
          ? `${selectedIds.length}개 정리할게요`
          : "정리할 재료를 골라 주세요"}
      </Button>
    ) : (
      <Button
        icon={Plus}
        onPress={openEntryMethodSheet}
        fullWidth
        testID="inventory-add-button"
      >
        재료 넣으러 가기
      </Button>
    );

  // Undo temporarily owns the footer — one bottom action at a time.
  const footer = deferredRemoval.undoLabel ? (
    <View
      style={[styles.undoSnackbar, shouldStack && styles.undoSnackbarStacked]}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${deferredRemoval.undoLabel}. 되돌릴게요`}
    >
      <Text style={styles.undoSnackbarLabel} numberOfLines={2}>
        {deferredRemoval.undoLabel}
      </Text>
      <Pressable
        onPress={deferredRemoval.undoRemoval}
        accessibilityRole="button"
        accessibilityLabel="되돌릴게요"
        hitSlop={spacing.xs}
        style={({ pressed }) => [
          styles.undoSnackbarAction,
          pressed && styles.undoSnackbarActionPressed,
        ]}
      >
        <Text style={styles.undoSnackbarActionLabel}>되돌릴게요</Text>
      </Pressable>
    </View>
  ) : (
    primaryFooter
  );

  return (
    <Screen
      scroll={false}
      contentWidth="wide"
      bottomInsetMode="navigator"
      testID="inventory-screen"
      footer={footer}
      contentStyle={styles.screenContent}
    >
      <View style={styles.fridgeScene}>
        <ImageBackground
          source={fridgeInteriorBg}
          style={styles.fridgeSceneBackground}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          importantForAccessibility="no"
        />
        {/* Soft wash so white inventory cards stay readable on the fridge cavity. */}
        <View
          pointerEvents="none"
          style={styles.fridgeSceneVeil}
          importantForAccessibility="no-hide-descendants"
        />
        <FlatList
          style={styles.listFlex}
          testID="inventory-list"
          data={
            isLoading && !hasLoadedInventory
              ? []
              : isError && !hasLoadedInventory
                ? []
                : isEmptyInventory || isFilteredEmpty
                  ? []
                  : urgencySections
          }
          keyExtractor={(section) => section.key}
          extraData={{
            collapsedSectionKeys,
            isSelectionMode,
            selectedIds,
          }}
          refreshControl={
            <RefreshControl
              tintColor={colors.primary}
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <SpaceSwitcher />
              {isLoading && !hasLoadedInventory ? (
                <View
                  style={[
                    styles.filterToolbar,
                    heroNotice.show && {
                      backgroundColor:
                        inventoryHeroToolbarFills[heroNotice.tone],
                    },
                  ]}
                >
                  {inventoryHeroBubble}
                  <HomeStatsSkeleton />
                </View>
              ) : showListChrome && !isSelectionMode ? (
                <View
                  style={[
                    styles.filterToolbar,
                    heroNotice.show && {
                      backgroundColor:
                        inventoryHeroToolbarFills[heroNotice.tone],
                    },
                  ]}
                >
                  {inventoryHeroBubble}
                  <View style={styles.filterCluster}>
                  <View style={styles.searchToolbar}>
                    <View style={styles.searchField}>
                      <Search
                        color={colors.mutedText}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.4}
                      />
                      <AppTextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="재료 이름이나 브랜드 검색"
                        accessibilityLabel="재료 이름이나 브랜드 검색"
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        style={styles.searchInput}
                      />
                      {hasSearchQuery ? (
                        <Pressable
                          onPress={() => setSearchQuery("")}
                          accessibilityRole="button"
                          accessibilityLabel="검색어 지우기"
                          style={({ pressed }) => [
                            styles.toolbarIconButton,
                            pressed && styles.headerFilterButtonPressed,
                          ]}
                        >
                          <X
                            color={colors.subtext}
                            size={spacing.sm + spacing.xxs}
                            strokeWidth={2.4}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => enterSelectionMode()}
                      style={({ pressed }) => [
                        styles.moreMenuButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="여러 개 정리할게요"
                      accessibilityHint="정리할 재료를 골라 한 번에 빼 둘 수 있어요."
                    >
                      <ListChecks
                        color={colors.subtext}
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                    </Pressable>
                  </View>

                  <View
                    style={[
                      styles.filterPairRow,
                      shouldStackDense && styles.filterPairRowDense,
                    ]}
                  >
                    <View
                      style={[
                        styles.filterControls,
                        shouldStackDense && styles.filterControlsDense,
                      ]}
                    >
                      <View
                        style={styles.expiryTrafficRow}
                        testID="inventory-expiry-traffic"
                      >
                        <ExpiryTrafficLamp
                          label="만료"
                          count={facetCounts.status.expired}
                          tone="danger"
                          lampOn={
                            filter === "all"
                              ? facetCounts.status.expired > 0
                              : filter === "expired"
                          }
                          selected={filter === "expired"}
                          onPress={() => toggleExpiryFilter("expired")}
                          testID="inventory-expiry-filter-expired"
                          accessibilityLabel={`만료, ${facetCounts.status.expired}개`}
                          accessibilityHint={
                            filter === "expired"
                              ? "다시 누르면 전체 보관함을 보여 드려요."
                              : "기한이 지난 재료만 보여 드릴게요."
                          }
                        />
                        <ExpiryTrafficLamp
                          label="곧"
                          count={facetCounts.status.within7}
                          tone="warning"
                          lampOn={
                            filter === "all"
                              ? facetCounts.status.within7 > 0
                              : filter === "within7"
                          }
                          selected={filter === "within7"}
                          onPress={() => toggleExpiryFilter("within7")}
                          testID="inventory-expiry-filter-within7"
                          accessibilityLabel={`곧 만료, ${facetCounts.status.within7}개`}
                          accessibilityHint={
                            filter === "within7"
                              ? "다시 누르면 전체 보관함을 보여 드려요."
                              : "7일 안에 손볼 재료만 보여 드릴게요."
                          }
                        />
                        <ExpiryTrafficLamp
                          label="여유"
                          count={facetCounts.status.safe}
                          tone="success"
                          lampOn={
                            filter === "all"
                              ? facetCounts.status.safe > 0
                              : filter === "safe"
                          }
                          selected={filter === "safe"}
                          onPress={() => toggleExpiryFilter("safe")}
                          testID="inventory-expiry-filter-safe"
                          accessibilityLabel={`여유, ${facetCounts.status.safe}개`}
                          accessibilityHint={
                            filter === "safe"
                              ? "다시 누르면 전체 보관함을 보여 드려요."
                              : "아직 여유 있는 재료만 보여 드릴게요."
                          }
                        />
                      </View>

                      <View
                        style={[
                          styles.locationFilterTile,
                          shouldStackDense && styles.locationFilterTileDense,
                          hasLocationFilter && styles.locationFilterTileActive,
                        ]}
                      >
                        <Pressable
                          onPress={openLocationFilterSheet}
                          accessibilityRole="button"
                          accessibilityLabel={
                            hasLocationFilter
                              ? `${selectedLocationLabel} 위치 필터, 바꿀게요`
                              : "위치별로 볼게요"
                          }
                          accessibilityHint="냉장고·냉동실처럼 위치만 골라 볼 수 있어요."
                          style={({ pressed }) => [
                            styles.locationFilterMain,
                            pressed && styles.filterControlPressed,
                          ]}
                        >
                          <MapPin
                            color={
                              hasLocationFilter
                                ? colors.primary
                                : colors.subtext
                            }
                            size={spacing.sm}
                            strokeWidth={2.4}
                          />
                          <AppText
                            variant="bodySmall"
                            tone={hasLocationFilter ? "primary" : "default"}
                            numberOfLines={1}
                            style={styles.locationFilterTitle}
                          >
                            {selectedLocationLabel}
                          </AppText>
                        </Pressable>
                      </View>
                    </View>
                    <Pressable
                      onPress={clearListFilters}
                      disabled={!hasActiveFilters}
                      style={({ pressed }) => [
                        styles.moreMenuButton,
                        pressed &&
                          hasActiveFilters &&
                          styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !hasActiveFilters }}
                      accessibilityLabel={
                        hasActiveFilters
                          ? "골라둔 조건을 풀어 볼게요"
                          : "이미 전체 보관함을 보고 있어요"
                      }
                      accessibilityHint="검색어와 유통기한·위치 조건을 모두 풀어요."
                    >
                      <RefreshCw
                        color={
                          hasActiveFilters ? colors.subtext : colors.mutedText
                        }
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                    </Pressable>
                  </View>
                  </View>
                </View>
              ) : showListChrome && isSelectionMode ? (
                <View
                  style={styles.selectionRow}
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={
                    selectedIds.length
                      ? `${selectedIds.length}개 골랐어요`
                      : "재료를 고르는 중이에요"
                  }
                >
                  <View style={styles.selectionSummary}>
                    <Text style={styles.selectionTitle} numberOfLines={1}>
                      {selectedIds.length
                        ? `${selectedIds.length}개`
                        : "고를게요"}
                    </Text>
                  </View>
                  <View style={styles.headerActions}>
                    {expiredVisibleIds.length > 0 ? (
                      <Pressable
                        onPress={handleToggleAllExpiredVisible}
                        hitSlop={spacing.xs}
                        accessibilityRole="button"
                        accessibilityLabel={
                          allExpiredVisibleSelected
                            ? "만료된 재료 선택 풀게요"
                            : "만료된 재료 전부 고를게요"
                        }
                        style={({ pressed }) => [
                          styles.headerFilterButton,
                          pressed && styles.headerFilterButtonPressed,
                        ]}
                      >
                        <Text style={styles.headerFilterLabel}>
                          {allExpiredVisibleSelected
                            ? "만료 풀기"
                            : "만료 전부"}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={cancelSelectionMode}
                      hitSlop={spacing.xs}
                      style={({ pressed }) => [
                        styles.headerFilterButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="선택 닫기"
                    >
                      <Text style={styles.headerFilterLabel}>닫기</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {successMessage ? (
                <FeedbackBanner tone="success" title={successMessage} />
              ) : null}

              {deferredRemoval.errorMessage || actionErrorMessage ? (
                <FeedbackBanner
                  tone="danger"
                  title="앗, 잠시 문제가 생겼어요"
                  description={
                    deferredRemoval.errorMessage ??
                    actionErrorMessage ??
                    undefined
                  }
                />
              ) : null}

              {isError && hasLoadedInventory ? (
                <FeedbackBanner
                  tone="danger"
                  title="앗, 보관함을 불러오지 못했어요"
                  description={loadErrorMessage}
                  actionLabel="다시 불러올게요"
                  onAction={() => {
                    void refetch();
                  }}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            isLoading && !hasLoadedInventory ? (
              <InventoryListSkeleton />
            ) : isError && !hasLoadedInventory ? (
              <EmptyState
                mood="worry"
                title="앗, 보관함을 불러오지 못했어요"
                description={loadErrorMessage}
                actionLabel="다시 불러올게요"
                onAction={() => {
                  void refetch();
                }}
              />
            ) : isEmptyInventory ? (
              <EmptyState
                mood="empty"
                title="아직 넣어둔 재료가 없어요"
                description="장고가 빈 냉장고를 바라보고 있어요. 첫 재료를 넣으러 가볼까요?"
                actionLabel="재료 넣으러 가기"
                onAction={openEntryMethodSheet}
              />
            ) : isFilteredEmpty ? (
              <EmptyState
                mood={hasSearchQuery ? "idle" : getFilteredEmptyMood(filter)}
                showMascot={false}
                title={getFilteredEmptyTitle(filter, hasSearchQuery)}
                description={getFilteredEmptyDescription(
                  filter,
                  hasLocationFilter,
                  hasSearchQuery,
                )}
                actionLabel={
                  hasSearchQuery && !hasStatusFilter && !hasLocationFilter
                    ? "검색어 지울게요"
                    : filter === "all" && hasLocationFilter && !hasSearchQuery
                      ? "모든 위치 볼게요"
                      : "필터 풀게요"
                }
                onAction={
                  hasSearchQuery && !hasStatusFilter && !hasLocationFilter
                    ? () => setSearchQuery("")
                    : clearListFilters
                }
              />
            ) : null
          }
          renderItem={({ item: section }) => (
            <UrgencySection
              section={section}
              collapsed={collapsedSectionKeySet.has(section.key)}
              onToggle={() => toggleSectionCollapsed(section.key)}
            >
              {section.data.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  selectionMode={isSelectionMode}
                  selected={selectedIdSet.has(item.id)}
                  resolveLocationLabel={resolveLabel}
                  onPress={handleCardPress}
                  onLongPress={(pressedItem) =>
                    handleCardLongPress(pressedItem.id)
                  }
                  onEdit={handleEditItem}
                />
              ))}
            </UrgencySection>
          )}
        />
      </View>

      <InventoryCleanupSheet
        item={cleanupItem}
        onClose={() => setCleanupItem(null)}
        onConsumeAll={handleConsumeAll}
        onConsumePartial={handleConsumePartial}
      />

      <BottomSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        title="보관 위치 선택"
        description="선택한 위치의 재료만 바로 보여 드릴게요."
        footer={
          <View style={styles.locationSheetFooter}>
            {hasLocationFilter ? (
              <Button
                variant="secondary"
                onPress={() => selectLocationFilter("all")}
                fullWidth
              >
                전체 위치 보기
              </Button>
            ) : null}
            <Button
              variant="surface"
              onPress={() => {
                setFilterSheetVisible(false);
                router.push("/settings/storage-locations");
              }}
              fullWidth
            >
              보관 위치 관리
            </Button>
          </View>
        }
      >
        <View style={styles.locationOptionGrid}>
          <Pressable
            onPress={() => selectLocationFilter("all")}
            accessibilityRole="button"
            accessibilityState={{ selected: location === "all" }}
            accessibilityLabel={`전체 위치, ${facetCounts.locationTotal}개`}
            style={({ pressed }) => [
              styles.locationOption,
              location === "all" && styles.locationOptionSelected,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.locationOptionLabel,
                location === "all" && styles.locationOptionLabelSelected,
              ]}
            >
              전체 위치
            </Text>
            <View style={styles.locationOptionMeta}>
              <Text style={styles.locationOptionCount}>
                {facetCounts.locationTotal}
              </Text>
              {location === "all" ? (
                <Check
                  color={colors.primary}
                  size={spacing.sm}
                  strokeWidth={2.8}
                />
              ) : null}
            </View>
          </Pressable>
          {selectableOptions.map((option) => {
            const selected = location === option.key;
            const count = facetCounts.location[option.key] ?? 0;

            return (
              <Pressable
                key={option.key}
                onPress={() => selectLocationFilter(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label}, ${count}개`}
                accessibilityHint={`${option.label}의 재료만 보여 드릴게요.`}
                style={({ pressed }) => [
                  styles.locationOption,
                  selected && styles.locationOptionSelected,
                  pressed && styles.headerFilterButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.locationOptionLabel,
                    selected && styles.locationOptionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <View style={styles.locationOptionMeta}>
                  <Text style={styles.locationOptionCount}>{count}</Text>
                  {selected ? (
                    <Check
                      color={colors.primary}
                      size={spacing.sm}
                      strokeWidth={2.8}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={entryMethodVisible}
        onClose={() => setEntryMethodVisible(false)}
        title="어떻게 넣을까요?"
        description="바코드를 비추거나, 직접 입력해서 냉장고에 넣을 수 있어요."
        mascotMood="idle"
      >
        <View style={styles.entryMethodActions}>
          <Button
            icon={Barcode}
            onPress={goToScanner}
            fullWidth
            variant="primary"
          >
            바코드로 넣을래요
          </Button>
          <Button
            icon={PenLine}
            onPress={goToManualRegister}
            fullWidth
            variant="surface"
          >
            직접 입력할게요
          </Button>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function getFilteredEmptyMood(filter: InventoryViewFilter) {
  if (filter === "within7" || filter === "safe") {
    return "happy" as const;
  }

  return "idle" as const;
}

function getFilteredEmptyTitle(
  filter: InventoryViewFilter,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return "찾는 재료가 없어요";
  }

  if (filter === "within7") {
    return "7일 안에 손볼 재료가 없어요";
  }

  if (filter === "expired") {
    return "기한 지난 재료가 없어요";
  }

  if (filter === "safe") {
    return "여유 있는 재료가 없어요";
  }

  return "이 위치에는 재료가 없어요";
}

function getFilteredEmptyDescription(
  filter: InventoryViewFilter,
  hasLocationFilter: boolean,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return hasLocationFilter || filter !== "all"
      ? "검색어를 지우거나 필터를 넓혀 볼까요?"
      : "다른 이름으로 찾아보거나, 새 재료를 넣어볼까요?";
  }

  if (filter === "within7") {
    return hasLocationFilter
      ? "위치를 바꾸거나 전체 보관함을 둘러볼까요?"
      : "급한 재료가 없어요. 전체 목록을 보거나 재료를 더 넣어볼까요?";
  }

  if (filter === "expired" || filter === "safe") {
    return hasLocationFilter
      ? "위치를 바꾸거나 전체 보관함을 둘러볼까요?"
      : "전체 목록을 둘러보거나 새 재료를 넣어볼까요?";
  }

  if (hasLocationFilter) {
    return "다른 위치를 고르거나, 새 재료를 넣어볼까요?";
  }

  return "조건을 조금 넓히거나, 새 재료를 넣어볼까요?";
}

type ExpiryTrafficTone = "danger" | "warning" | "success";

function UrgencySection({
  section,
  collapsed,
  onToggle,
  children,
}: {
  section: {
    key: InventoryUrgencySection;
    title: string;
    itemCount: number;
  };
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const description = inventoryUrgencySectionDescriptions[section.key];
  const tone = urgencySectionTones[section.key];
  const title = `${section.title} ${section.itemCount}건`;

  return (
    <View style={styles.urgencySection}>
      <View
        style={[
          styles.urgencySectionHeader,
          !collapsed && styles.urgencySectionHeaderExpanded,
        ]}
        accessibilityRole="header"
        accessibilityLabel={`${title}. ${description}`}
      >
        <AppText
          variant="bodySmall"
          tone={tone}
          scaleRole="chrome"
          densityAware={false}
          numberOfLines={1}
          style={styles.urgencySectionTitle}
        >
          {title}
        </AppText>
        <Pressable
          onPress={onToggle}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={
            collapsed
              ? `${section.title} 펼쳐 볼게요`
              : `${section.title} 접을게요`
          }
          accessibilityHint={
            collapsed
              ? "이 분류의 재료를 펼쳐 볼 수 있어요."
              : "이 분류의 재료를 접어요."
          }
          accessibilityState={{ expanded: !collapsed }}
          style={({ pressed }) => [
            styles.urgencySectionToggle,
            pressed && styles.headerFilterButtonPressed,
          ]}
        >
          <AppText
            variant="bodySmall"
            scaleRole="chrome"
            densityAware={false}
            numberOfLines={1}
          >
            {collapsed ? "펼치기" : "접기"}
          </AppText>
          {collapsed ? (
            <ChevronDown
              color={colors.text}
              size={typography.bodySmall.fontSize}
              strokeWidth={2.4}
            />
          ) : (
            <ChevronUp
              color={colors.text}
              size={typography.bodySmall.fontSize}
              strokeWidth={2.4}
            />
          )}
        </Pressable>
      </View>
      {collapsed ? null : (
        <View style={styles.urgencySectionBody}>{children}</View>
      )}
    </View>
  );
}

function ExpiryTrafficLamp({
  label,
  count,
  tone,
  lampOn,
  selected,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  count: number;
  tone: ExpiryTrafficTone;
  lampOn: boolean;
  selected: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  accessibilityHint: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.expiryTrafficLamp,
        pressed && styles.headerFilterButtonPressed,
      ]}
    >
      <StatCard
        variant="traffic"
        mini
        showLabel={false}
        label={label}
        value={count}
        tone={tone}
        selected={lampOn}
        showGlow={selected}
      />
      <AppText
        variant="caption"
        tone={selected ? "default" : "subtext"}
        scaleRole="chrome"
        densityAware={false}
        numberOfLines={1}
        accessible={false}
        style={styles.expiryTrafficLampLabel}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterToolbar: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroBubble: {
    gap: spacing.sm,
  },
  filterCluster: {
    gap: spacing.xs,
  },
  searchToolbar: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  toolbarIconButton: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  moreMenuButton: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterPairRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  filterPairRowDense: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  filterControls: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  filterControlsDense: {
    flexDirection: "column",
    alignItems: "stretch",
    flexGrow: 0,
  },
  expiryTrafficRow: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs, // 4px between mini lamps in the cluster
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  expiryTrafficLamp: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs, // 4px between lamp and inline label
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.md,
  },
  expiryTrafficLampLabel: {
    flexShrink: 1,
  },
  locationFilterTile: {
    flexGrow: 0,
    flexShrink: 0,
    // 128: default "모든 위치" width; stays put when a location is selected.
    width: spacing.xxxl * 2,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  locationFilterTileDense: {
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
  },
  locationFilterTileActive: {
    borderColor: colors.primary,
  },
  locationFilterMain: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  locationFilterTitle: {
    flex: 1,
    minWidth: 0,
  },
  filterControlPressed: {
    opacity: 0.82,
  },
  locationOptionGrid: {
    gap: spacing.xs,
  },
  locationOption: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  locationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  locationOptionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  locationOptionLabelSelected: {
    color: colors.primary,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  locationOptionMeta: {
    minWidth: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  locationOptionCount: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.subtext,
  },
  locationSheetFooter: {
    gap: spacing.xs,
  },
  entryMethodActions: {
    gap: spacing.xs,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xxs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    paddingVertical: spacing.xxs,
    fontSize: typography.bodyStrong.fontSize,
    lineHeight: typography.bodyStrong.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: spacing.xxs,
  },
  headerFilterButton: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.icon,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
  },
  headerFilterButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  headerFilterLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  selectionRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectionSummary: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    minHeight: touchTarget.min,
  },
  selectionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  undoSnackbar: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
  },
  undoSnackbarStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  undoSnackbarLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.surface,
  },
  undoSnackbarAction: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  undoSnackbarActionPressed: {
    backgroundColor: colors.subtext,
  },
  undoSnackbarActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.warningSoft,
  },
  screenContent: {
    flex: 1,
    gap: spacing.none,
    // Bleed fridge scene to Screen edges; list keeps the 24px inset itself.
    paddingHorizontal: spacing.none,
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  fridgeScene: {
    flex: 1,
    overflow: "hidden",
  },
  fridgeSceneBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  fridgeSceneVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.24,
  },
  listFlex: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + spacing.sm,
    gap: spacing.sm,
  },
  listHeader: {
    gap: spacing.sm,
  },
  urgencySection: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  urgencySectionHeader: {
    minHeight: touchTarget.min,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  urgencySectionHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  urgencySectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  urgencySectionToggle: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
  },
  urgencySectionBody: {
    padding: spacing.xxs, // 4px: keep expiry groups compact around stacked cards
    gap: spacing.xxs,
    backgroundColor: colors.mutedSurface,
  },
});
