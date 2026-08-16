import {
  formatDateKoreanCompact,
  getExpiryTrafficBucket,
  isTrackedItem,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  Archive,
  Barcode,
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  MapPin,
  PenLine,
  Plus,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ImageBackground,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  SectionList,
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
import { InventoryGroupCard } from "../../src/components/InventoryGroupCard";
import { Screen } from "../../src/components/Screen";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import { StatCard } from "../../src/components/StatCard";
import {
  buildInventoryFacetCounts,
  buildInventoryUrgencySections,
  filterInventoryItems,
  getInventoryGroupSectionSlot,
  inventoryUrgencySectionDescriptions,
  parseInventoryViewFilter,
  type InventoryUrgencySection,
  type InventoryViewFilter,
} from "../../src/features/inventory/filters";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import {
  useDeferredInventoryItemRemoval,
  type InventoryRemovalAction,
} from "../../src/features/inventory/use-deferred-inventory-item-removal";
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

export default function InventoryScreen() {
  const { shouldStack } = useResponsiveLayout();
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
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
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
  const listSections = useMemo(
    () =>
      urgencySections.map((section) => ({
        ...section,
        data: collapsedSectionKeySet.has(section.key) ? [] : section.data,
      })),
    [collapsedSectionKeySet, urgencySections],
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
    () => buildInventoryFacetCounts(trackedItems, filter, location, searchQuery),
    [trackedItems, filter, location, searchQuery],
  );

  const hasLocationFilter = location !== "all";
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasStatusFilter = filter !== "all";
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

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);

    setSelectedIds((current) => {
      const nextIds = current.filter((id) => visibleIdSet.has(id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [visibleIds]);

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

  const handleCardPress = (id: string) => {
    if (isSelectionMode) {
      toggleSelectedId(id);
      return;
    }

    router.push({
      pathname: "/inventory/[id]",
      params: { id, mode: "edit" },
    });
  };

  const handleCardLongPress = (id: string) => {
    enterSelectionMode(id);
  };

  const setGroupExpanded = (groupId: string, expanded: boolean) => {
    setExpandedGroupIds((current) =>
      expanded
        ? [...new Set([...current, groupId])]
        : current.filter((id) => id !== groupId),
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

  const handleDiscard = (item: InventoryItem) => {
    setCleanupItem(null);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.scheduleRemoval(item, "discard");
  };

  const handleConsume = (item: InventoryItem) => {
    setCleanupItem(null);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.scheduleRemoval(item, "consume");
  };

  const openCleanupSheet = (item: InventoryItem) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.clearError();
    setCleanupItem(item);
  };

  const applyCleanupAction = (action: InventoryRemovalAction) => {
    if (!cleanupItem) {
      return;
    }

    if (action === "consume") {
      handleConsume(cleanupItem);
      return;
    }

    handleDiscard(cleanupItem);
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
      style={[
        styles.undoSnackbar,
        shouldStack && styles.undoSnackbarStacked,
      ]}
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
        <SectionList
          style={styles.listFlex}
          testID="inventory-list"
          sections={
            isLoading && !hasLoadedInventory
              ? []
              : isError && !hasLoadedInventory
                ? []
                : isEmptyInventory || isFilteredEmpty
                  ? []
                  : urgencySections
          }
          keyExtractor={(group) => group.id}
          stickySectionHeadersEnabled={false}
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
                <HomeStatsSkeleton />
              ) : showListChrome && !isSelectionMode ? (
                <View style={styles.filterToolbar}>
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

                  <View style={styles.filterPairRow}>
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
                        label="곧 만료"
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
                            hasLocationFilter ? colors.primary : colors.subtext
                          }
                          size={spacing.sm}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={[
                            styles.locationFilterTitle,
                            hasLocationFilter &&
                              styles.locationFilterTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {selectedLocationLabel}
                        </Text>
                      </Pressable>
                      {hasStatusFilter ? (
                        <Pressable
                          onPress={() => applyFilter("all")}
                          accessibilityRole="button"
                          accessibilityLabel="유통기한 필터 풀고 전체 볼게요"
                          hitSlop={spacing.xxs}
                          style={({ pressed }) => [
                            styles.locationFilterClearStatus,
                            pressed && styles.headerFilterButtonPressed,
                          ]}
                        >
                          <Text style={styles.locationFilterClearStatusLabel}>
                            전체 보기
                          </Text>
                        </Pressable>
                      ) : null}
                      {hasLocationFilter ? (
                        <Pressable
                          onPress={() => setLocation("all")}
                          hitSlop={spacing.xs}
                          accessibilityRole="button"
                          accessibilityLabel="위치 필터 풀게요"
                          style={({ pressed }) => [
                            styles.locationFilterClear,
                            pressed && styles.headerFilterButtonPressed,
                          ]}
                        >
                          <X
                            color={colors.primary}
                            size={spacing.sm}
                            strokeWidth={2.4}
                          />
                        </Pressable>
                      ) : null}
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
                          {allExpiredVisibleSelected ? "만료 풀기" : "만료 전부"}
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
          renderItem={({ item: group, index, section }) => (
            <InventoryGroupCard
              group={group}
              sectionSlot={getInventoryGroupSectionSlot(
                index,
                section.data.length,
              )}
              expanded={expandedGroupIds.includes(group.id)}
              onExpandedChange={(expanded) =>
                setGroupExpanded(group.id, expanded)
              }
              selectionMode={isSelectionMode}
              selectedIds={selectedIdSet}
              resolveLocationLabel={resolveLabel}
              onItemPress={(item) => handleCardPress(item.id)}
              onItemLongPress={(item) => handleCardLongPress(item.id)}
              onItemCleanup={openCleanupSheet}
            />
          )}
          renderSectionHeader={({ section }) => (
            <UrgencySectionHeader
              section={section}
              isFirst={section.key === urgencySections[0]?.key}
            />
          )}
        />
      </View>

      <BottomSheet
        visible={cleanupItem !== null}
        onClose={() => setCleanupItem(null)}
        title="어떻게 정리할까요?"
        description={
          cleanupItem
            ? `${cleanupItem.displayName} · ${formatDateKoreanCompact(cleanupItem.expiryDate)}까지`
            : undefined
        }
      >
        <View style={styles.cleanupSheetActions}>
          <Pressable
            onPress={() => applyCleanupAction("consume")}
            accessibilityRole="button"
            accessibilityLabel="다 먹었어요"
            style={({ pressed }) => [
              styles.cleanupSheetOption,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <View style={styles.cleanupSheetOptionIcon}>
              <Utensils
                color={colors.primary}
                size={spacing.md}
                strokeWidth={2.4}
              />
            </View>
            <View style={styles.cleanupSheetOptionCopy}>
              <Text style={styles.cleanupSheetOptionTitle}>다 먹었어요</Text>
              <Text style={styles.cleanupSheetOptionDescription}>
                잘 드셨군요. 보관함에서 슬쩍 빼 둘게요
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => applyCleanupAction("discard")}
            accessibilityRole="button"
            accessibilityLabel="보관함에서 빼둘게요"
            style={({ pressed }) => [
              styles.cleanupSheetOption,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <View
              style={[
                styles.cleanupSheetOptionIcon,
                styles.cleanupSheetOptionIconSoftDanger,
              ]}
            >
              <Archive
                color={colors.danger}
                size={spacing.md}
                strokeWidth={2.4}
              />
            </View>
            <View style={styles.cleanupSheetOptionCopy}>
              <Text style={styles.cleanupSheetOptionTitle}>
                보관함에서 빼둘게요
              </Text>
              <Text style={styles.cleanupSheetOptionDescription}>
                버리거나 비운 재료라면 여기서 정리해요
              </Text>
            </View>
          </Pressable>
        </View>
      </BottomSheet>

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

/** Visual chip ~40px; vertical inset meets the 48px touch target. */
const EXPIRY_TRAFFIC_HIT_SLOP = {
  top: spacing.xxs,
  bottom: spacing.xxs,
  left: 0,
  right: 0,
} as const;

function UrgencySectionHeader({
  section,
  isFirst,
}: {
  section: {
    key: InventoryUrgencySection;
    title: string;
    itemCount: number;
  };
  isFirst: boolean;
}) {
  const description = inventoryUrgencySectionDescriptions[section.key];
  const tone = urgencySectionTones[section.key];

  return (
    <View
      style={[
        styles.urgencySectionHeader,
        !isFirst && styles.urgencySectionHeaderFollow,
      ]}
      accessibilityRole="header"
      accessibilityLabel={`${section.title} ${section.itemCount}건. ${description}`}
    >
      <AppText
        variant="bodyStrong"
        tone={tone}
        numberOfLines={1}
        style={styles.urgencySectionTitle}
      >
        {section.title}
      </AppText>
      <View
        style={[
          styles.urgencySectionCountPill,
          { backgroundColor: urgencySectionSoftColors[section.key] },
        ]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <AppText
          variant="caption"
          tone={tone}
          scaleRole="chrome"
          densityAware={false}
          style={styles.urgencySectionCount}
        >
          {section.itemCount}건
        </AppText>
      </View>
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
      hitSlop={EXPIRY_TRAFFIC_HIT_SLOP}
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
        label={label}
        value={count}
        tone={tone}
        selected={lampOn}
        showGlow={selected}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterToolbar: {
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
  },
  filterPairRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.xs,
  },
  expiryTrafficRow: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs, // 4px between mini lamps in the cluster
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs, // 4px compact housing vs home's 16
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
  expiryTrafficLamp: {
    width: spacing.xxxl,
    minWidth: spacing.xl,
    flexShrink: 1,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  locationFilterTile: {
    flex: 1,
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
  locationFilterTileActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
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
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  locationFilterTitleActive: {
    color: colors.primary,
  },
  locationFilterClearStatus: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  locationFilterClearStatusLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  locationFilterClear: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  filterControlPressed: {
    opacity: 0.82,
  },
  cleanupSheetActions: {
    gap: spacing.xs,
  },
  cleanupSheetOption: {
    minHeight: touchTarget.cta,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cleanupSheetOptionIcon: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  cleanupSheetOptionIconSoftDanger: {
    backgroundColor: colors.dangerSoft,
  },
  cleanupSheetOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  cleanupSheetOptionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  cleanupSheetOptionDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
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
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    paddingVertical: spacing.xxs,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.body.fontFamily,
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
  },
  listHeader: {
    gap: spacing.xs,
  },
  urgencySectionHeader: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  urgencySectionHeaderFollow: {
    marginTop: spacing.md,
  },
  urgencySectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  urgencySectionCountPill: {
    flexShrink: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs, // 4px so the count chip stays shorter than the 48px header
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  urgencySectionCount: {
    fontFamily: typography.title.fontFamily,
    fontVariant: ["tabular-nums"],
  },
});
