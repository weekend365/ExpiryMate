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
  ListChecks,
  MapPin,
  MoreHorizontal,
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
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import fridgeInteriorBg from "../../assets/backgrounds/fridge-interior-bg.png";
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
import {
  buildInventoryFacetCounts,
  buildInventoryUrgencySections,
  filterInventoryItems,
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

const urgencySectionAccentColors: Record<InventoryUrgencySection, string> = {
  expired: colors.danger,
  within7: colors.warning,
  safe: colors.success,
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
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const [entryMethodVisible, setEntryMethodVisible] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
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
    setMoreSheetVisible(false);
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
    setMoreSheetVisible(false);
    setIsSelectionMode(true);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredRemoval.clearError();
    setSelectedIds(initialId ? [initialId] : []);
  };

  const openSelectionFromMore = () => {
    setMoreSheetVisible(false);
    enterSelectionMode();
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
                      onPress={() => setMoreSheetVisible(true)}
                      style={({ pressed }) => [
                        styles.moreMenuButton,
                        hasLocationFilter && styles.moreMenuButtonActive,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="더 보기"
                      accessibilityHint="위치 필터나 여러 개 정리를 고를 수 있어요."
                    >
                      <MoreHorizontal
                        color={
                          hasLocationFilter ? colors.primary : colors.subtext
                        }
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                      {hasLocationFilter ? (
                        <View style={styles.moreMenuBadge} />
                      ) : null}
                    </Pressable>
                  </View>

                  <ScrollView
                    horizontal
                    style={styles.expiryFilterScroll}
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.expiryFilterChipRow}
                  >
                    <ExpirySignalChip
                      label="전체"
                      count={facetCounts.status.all}
                      selected={filter === "all"}
                      emphasize={facetCounts.status.all > 0}
                      onPress={() => applyFilter("all")}
                    />
                    <ExpirySignalChip
                      label="만료됨"
                      count={facetCounts.status.expired}
                      tone="danger"
                      selected={filter === "expired"}
                      emphasize={facetCounts.status.expired > 0}
                      onPress={() => applyFilter("expired")}
                    />
                    <ExpirySignalChip
                      label="7일 이내"
                      count={facetCounts.status.within7}
                      tone="warning"
                      selected={filter === "within7"}
                      emphasize={facetCounts.status.within7 > 0}
                      onPress={() => applyFilter("within7")}
                    />
                    <ExpirySignalChip
                      label="여유"
                      count={facetCounts.status.safe}
                      tone="success"
                      selected={filter === "safe"}
                      emphasize={facetCounts.status.safe > 0}
                      onPress={() => applyFilter("safe")}
                    />
                  </ScrollView>

                  {hasLocationFilter ? (
                    <View style={styles.activeLocationChip}>
                      <Pressable
                        onPress={openLocationFilterSheet}
                        accessibilityRole="button"
                        accessibilityLabel={`${selectedLocationLabel} 위치 필터, 바꿀게요`}
                        style={({ pressed }) => [
                          styles.activeLocationChipMain,
                          pressed && styles.filterControlPressed,
                        ]}
                      >
                        <MapPin
                          color={colors.primary}
                          size={spacing.sm}
                          strokeWidth={2.4}
                        />
                        <Text style={styles.activeLocationChipLabel}>
                          {selectedLocationLabel}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setLocation("all")}
                        hitSlop={spacing.xs}
                        accessibilityRole="button"
                        accessibilityLabel="위치 필터 풀게요"
                        style={({ pressed }) => [
                          styles.activeLocationClear,
                          pressed && styles.headerFilterButtonPressed,
                        ]}
                      >
                        <X
                          color={colors.primary}
                          size={spacing.sm}
                          strokeWidth={2.4}
                        />
                      </Pressable>
                    </View>
                  ) : null}
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
          renderItem={({ item: group }) => (
            <InventoryGroupCard
              group={group}
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
            <View style={styles.urgencySectionHeader}>
              <View
                style={styles.urgencySectionAccentSlot}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <View
                  style={[
                    styles.urgencySectionAccent,
                    {
                      backgroundColor: urgencySectionAccentColors[section.key],
                    },
                  ]}
                />
              </View>
              <Text style={styles.urgencySectionTitle}>
                {section.title} {section.itemCount}건
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
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
        visible={moreSheetVisible}
        onClose={() => setMoreSheetVisible(false)}
        title="무엇을 할까요?"
        description="위치만 보거나, 여러 재료를 한 번에 정리할 수 있어요."
      >
        <View style={styles.moreSheetActions}>
          <Pressable
            onPress={openLocationFilterSheet}
            accessibilityRole="button"
            accessibilityLabel="위치별로 볼게요"
            style={({ pressed }) => [
              styles.moreSheetOption,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <View style={styles.moreSheetOptionIcon}>
              <MapPin
                color={colors.primary}
                size={spacing.md}
                strokeWidth={2.4}
              />
            </View>
            <View style={styles.moreSheetOptionCopy}>
              <Text style={styles.moreSheetOptionTitle}>위치별로 볼게요</Text>
              <Text style={styles.moreSheetOptionDescription}>
                {hasLocationFilter
                  ? `지금 ${selectedLocationLabel}만 보고 있어요`
                  : "냉장고·냉동실처럼 위치만 골라 볼 수 있어요"}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={openSelectionFromMore}
            accessibilityRole="button"
            accessibilityLabel="여러 개 정리할게요"
            style={({ pressed }) => [
              styles.moreSheetOption,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <View style={styles.moreSheetOptionIcon}>
              <ListChecks
                color={colors.primary}
                size={spacing.md}
                strokeWidth={2.4}
              />
            </View>
            <View style={styles.moreSheetOptionCopy}>
              <Text style={styles.moreSheetOptionTitle}>여러 개 정리할게요</Text>
              <Text style={styles.moreSheetOptionDescription}>
                정리할 재료를 골라 한 번에 빼 둘 수 있어요
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
    return "만료된 재료가 없어요";
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

type ExpirySignalTone = "default" | "danger" | "warning" | "success";

const expirySignalPalettes = {
  default: {
    signal: colors.text,
    selectedSignal: colors.text,
    selectedBackground: colors.surface,
    selectedText: colors.text,
  },
  danger: {
    signal: colors.danger,
    selectedSignal: colors.danger,
    selectedBackground: colors.dangerSoft,
    selectedText: colors.text,
  },
  warning: {
    signal: colors.warning,
    selectedSignal: colors.warning,
    selectedBackground: colors.warningSoft,
    selectedText: colors.text,
  },
  success: {
    signal: colors.success,
    selectedSignal: colors.success,
    selectedBackground: colors.successSoft,
    selectedText: colors.text,
  },
} as const;

const FILTER_CHIP_HIT_SLOP = {
  top: spacing.xxs,
  bottom: spacing.xxs,
  left: 0,
  right: 0,
} as const;

function ExpirySignalChip({
  label,
  count,
  tone = "default",
  selected,
  emphasize = true,
  onPress,
}: {
  label: string;
  count: number;
  tone?: ExpirySignalTone;
  selected: boolean;
  emphasize?: boolean;
  onPress: () => void;
}) {
  const palette = expirySignalPalettes[tone];
  const muted = !selected && !emphasize;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={FILTER_CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}개`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.expiryFilterChip,
        {
          backgroundColor: selected
            ? palette.selectedBackground
            : "transparent",
          opacity: muted ? 0.42 : 1,
        },
        pressed && styles.filterControlPressed,
      ]}
    >
      {tone !== "default" ? (
        <View
          style={[
            styles.expiryFilterLamp,
            {
              backgroundColor: selected
                ? palette.selectedSignal
                : palette.signal,
              opacity: selected ? 1 : emphasize ? 0.72 : 0.28,
            },
            selected && {
              shadowColor: palette.signal,
              ...styles.expiryFilterLampSelected,
            },
          ]}
        />
      ) : null}
      <Text
        style={[
          styles.expiryFilterChipLabel,
          {
            color: selected ? palette.selectedText : colors.text,
            fontFamily: emphasize || selected
              ? typography.bodyStrong.fontFamily
              : typography.label.fontFamily,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.expiryFilterChipCount,
          {
            color: selected
              ? palette.signal
              : emphasize
                ? colors.subtext
                : colors.mutedText,
          },
        ]}
      >
        {count}
      </Text>
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
  moreMenuButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  moreMenuBadge: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  expiryFilterScroll: {
    alignSelf: "stretch",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
    overflow: "hidden",
  },
  expiryFilterChipRow: {
    alignItems: "center",
    gap: spacing.xxs,
    padding: spacing.xxs,
  },
  expiryFilterChip: {
    minHeight: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs + spacing.xxs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  expiryFilterLamp: {
    width: spacing.xs,
    height: spacing.xs,
    flexShrink: 0,
    borderRadius: radius.pill,
  },
  expiryFilterLampSelected: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.62,
    shadowRadius: spacing.xs,
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  expiryFilterChipLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
  },
  expiryFilterChipCount: {
    minWidth: spacing.sm,
    textAlign: "center",
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    fontVariant: ["tabular-nums"],
  },
  activeLocationChip: {
    minHeight: touchTarget.min,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  activeLocationChipMain: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  activeLocationChipLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  activeLocationClear: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  filterControlPressed: {
    opacity: 0.82,
  },
  moreSheetActions: {
    gap: spacing.xs,
  },
  moreSheetOption: {
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
  moreSheetOptionIcon: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  moreSheetOptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  moreSheetOptionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  moreSheetOptionDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
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
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + spacing.xxs,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTranslucent,
    overflow: "hidden",
  },
  urgencySectionAccentSlot: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: spacing.xs,
    width: spacing.xxs,
    justifyContent: "center",
  },
  urgencySectionAccent: {
    width: spacing.xxs,
    height: spacing.md,
    borderRadius: radius.pill,
  },
  urgencySectionTitle: {
    ...typography.bodySmall,
    color: colors.subtext,
    fontWeight: "700",
  },
  itemSeparator: {
    height: spacing.xxs,
  },
});
