import {
  getExpiryTrafficBucket,
  isTrackedItem,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  ImageBackground,
  LayoutAnimation,
  RefreshControl,
  View,
} from "react-native";
import fridgeInteriorBg from "../../assets/backgrounds/fridge-interior-bg.png";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import {
  HomeStatsSkeleton,
  InventoryListSkeleton,
} from "../../src/components/ContentSkeleton";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryCleanupSheet } from "../../src/components/InventoryCleanupSheet";
import { InventoryCard } from "../../src/components/InventoryCard";
import { JangoHeroNoticeCarousel } from "../../src/components/JangoHeroNoticeCarousel";
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
import {
  getInventoryHeroNotice,
  getInventoryHeroNotices,
  type InventoryHeroAction,
} from "../../src/features/inventory/inventory-hero";
import { getCommittedFullConsumeTarget } from "../../src/features/inventory/deferred-inventory-removal";
import {
  InventoryFilterToolbar,
  InventorySelectionBar,
} from "../../src/features/inventory/inventory-list-header";
import {
  InventoryLocationFilterSheet,
  InventoryQuickEditSheet,
} from "../../src/features/inventory/inventory-list-sheets";
import type { InventoryEditMode } from "../../src/features/inventory/inventory-form-copy";
import { IngredientEntryMethodSheet } from "../../src/features/registration/ingredient-entry-method-sheet";
import {
  inventoryScreenStyles as styles,
} from "../../src/features/inventory/inventory-screen-styles";
import { UrgencySection } from "../../src/features/inventory/inventory-urgency-section";
import { useDeferredInventoryItemRemoval } from "../../src/features/inventory/use-deferred-inventory-item-removal";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import {
  photoParseRoute,
  registerRoute,
  scannerRoute,
} from "../../src/features/registration/registration-return";
import { isInventoryPhotoParseEnabled } from "../../src/features/photo-intake/photo-parse-enabled";
import { useStorageLocations } from "../../src/features/settings/use-storage-locations";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import {
  AffiliateEntryImpression,
  trackAffiliateEntryTap,
} from "../../src/features/affiliate/affiliate-entry-tracking";
import { colors } from "../../src/shared/theme";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function InventoryScreen() {
  const { shouldStackDense } = useResponsiveLayout();
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const filterParam = parseInventoryViewFilter(params.filter);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useInventoryList();
  const deferredRemoval = useDeferredInventoryItemRemoval();
  const { clearLastCommittedRemoval, lastCommittedRemoval } = deferredRemoval;
  const { activeSpaceId } = useActiveSpace();
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
  const [cleanupItem, setCleanupItem] = useState<InventoryItem | null>(null);
  const [quickEditItem, setQuickEditItem] = useState<InventoryItem | null>(
    null,
  );
  const [shoppingOfferTarget, setShoppingOfferTarget] =
    useState<InventoryItem | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [dismissedRemovalNotice, setDismissedRemovalNotice] = useState<
    string | null
  >(null);

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

  useEffect(() => {
    const committedTarget = getCommittedFullConsumeTarget(
      lastCommittedRemoval,
    );

    if (committedTarget) {
      setShoppingOfferTarget(committedTarget);
    }

    if (lastCommittedRemoval) {
      clearLastCommittedRemoval();
    }
  }, [clearLastCommittedRemoval, lastCommittedRemoval]);

  useEffect(() => {
    setShoppingOfferTarget(null);
    setQuickEditItem(null);
  }, [activeSpaceId]);

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
  const isFilteredEmpty =
    hasLoadedInventory &&
    !isError &&
    !isEmptyInventory &&
    filtered.length === 0;
  const showListChrome = hasLoadedInventory && !isError && !isEmptyInventory;
  const actionError =
    deferredRemoval.errorMessage ?? actionErrorMessage ?? null;
  const visibleRemovalNotice =
    deferredRemoval.undoLabel &&
    deferredRemoval.undoLabel !== dismissedRemovalNotice
      ? deferredRemoval.undoLabel
      : null;
  const inventoryActionNoticeTone = actionError
    ? "danger"
    : visibleRemovalNotice || shoppingOfferTarget
      ? "success"
      : null;
  const inventoryActionNotice = actionError ? (
    <FeedbackBanner
      testID="inventory-action-notice"
      tone="danger"
      title="앗, 잠시 문제가 생겼어요"
      description={actionError}
      transient
      speechDensity="default"
      speechTextVariant="bodySmall"
      onDismiss={() => {
        deferredRemoval.clearError();
        setActionErrorMessage(null);
      }}
    />
  ) : visibleRemovalNotice ? (
    <FeedbackBanner
      testID="inventory-action-notice"
      tone="success"
      title={visibleRemovalNotice}
      actionLabel="되돌리기"
      speechActionPlacement="inside"
      onAction={() => {
        deferredRemoval.undoRemoval();
        setShoppingOfferTarget(null);
      }}
      transient
      speechDensity="default"
      speechTextVariant="bodySmall"
      onDismiss={() => setDismissedRemovalNotice(visibleRemovalNotice)}
    />
  ) : shoppingOfferTarget ? (
    <AffiliateEntryImpression placement="inventory_consumed">
      <FeedbackBanner
        testID="inventory-action-notice"
        tone="success"
        title={`${shoppingOfferTarget.displayName} 다 썼어요.`}
        actionLabel="장보기에서 찾기"
        speechActionPlacement="inside"
        onAction={() => {
          trackAffiliateEntryTap("inventory_consumed");
          router.push({
            pathname: "/(tabs)/shop",
            params: {
              q: shoppingOfferTarget.displayName,
              source: "inventory_consumed",
            },
          });
        }}
        transient
        speechDensity="default"
        speechTextVariant="bodySmall"
        onDismiss={() => setShoppingOfferTarget(null)}
      />
    </AffiliateEntryImpression>
  ) : null;
  const inventoryStatusHero = useMemo(
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
  const handleInventoryHeroAction = (action: InventoryHeroAction) => {
    if (action === "retry") {
      void refetch();
      return;
    }
    if (action === "add_ingredient") {
      setEntryMethodVisible(true);
      return;
    }
    if (action === "clear_filters") {
      if (filter !== "all") applyFilter("all");
      if (hasLocationFilter) setLocation("all");
      if (hasSearchQuery) setSearchQuery("");
      return;
    }
    applyFilter(action === "show_expired" ? "expired" : "within7");
  };
  const inventoryStatusNotices = getInventoryHeroNotices({
    hero: inventoryStatusHero,
  }).map((notice) =>
    inventoryStatusHero.show && inventoryStatusHero.action
      ? {
          ...notice,
          onPress: () => handleInventoryHeroAction(inventoryStatusHero.action!),
          accessibilityHint:
            notice.actionLabel ??
            "해당 유통기한 상태의 재료만 보여 드릴게요.",
        }
      : notice,
  );
  const inventoryDefaultHero = inventoryStatusNotices.length ? (
    <JangoHeroNoticeCarousel notices={inventoryStatusNotices} />
  ) : null;
  const inventoryFilterHero = inventoryActionNotice ?? inventoryDefaultHero;
  const inventoryFilterHeroTone =
    inventoryActionNoticeTone ??
    (inventoryStatusHero.show ? inventoryStatusHero.tone : null);

  useEffect(() => {
    if (!deferredRemoval.undoLabel) {
      setDismissedRemovalNotice(null);
    }
  }, [deferredRemoval.undoLabel]);

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
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push(registerRoute("inventory"));
  };

  const goToScanner = () => {
    setEntryMethodVisible(false);
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push(scannerRoute("inventory"));
  };

  const goToPhotoParse = () => {
    setEntryMethodVisible(false);
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push(photoParseRoute("inventory"));
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
    setQuickEditItem(null);
    setIsSelectionMode(true);
    setShoppingOfferTarget(null);
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

  const handleSelectAllVisible = () => {
    setSelectedIds(visibleIds);
  };

  const handleSelectExpiredOnly = () => {
    if (!expiredVisibleIds.length) {
      return;
    }
    setSelectedIds(expiredVisibleIds);
  };

  const openCleanupSheet = (item: InventoryItem) => {
    setShoppingOfferTarget(null);
    setActionErrorMessage(null);
    deferredRemoval.clearError();
    setCleanupItem(item);
  };

  const handleCardPress = (item: InventoryItem) => {
    if (isSelectionMode) {
      toggleSelectedId(item.id);
      return;
    }

    setQuickEditItem(item);
  };

  const handleEditItem = (
    item: InventoryItem,
    mode: InventoryEditMode = "product",
  ) => {
    setQuickEditItem(null);
    router.push({
      pathname: "/inventory/[id]",
      params: { id: item.id, mode },
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
    if (!selectedIds.length) {
      return;
    }

    const itemsToDiscard = trackedItems.filter((item) =>
      selectedIdSet.has(item.id),
    );

    if (!itemsToDiscard.length) {
      return;
    }

    // Optimistic: leave selection mode immediately so the next pick feels instant.
    setActionErrorMessage(null);
    setShoppingOfferTarget(null);
    deferredRemoval.clearError();
    setSelectedIds([]);
    setIsSelectionMode(false);

    itemsToDiscard.forEach((item) => {
      deferredRemoval.scheduleRemoval(item, "discard");
    });
  };

  const handleConsumeAll = (item: InventoryItem) => {
    setCleanupItem(null);
    setActionErrorMessage(null);
    setShoppingOfferTarget(null);
    deferredRemoval.scheduleRemoval(item, "consume");
  };

  const handleConsumePartial = (item: InventoryItem, amountBase: number) => {
    setCleanupItem(null);
    setActionErrorMessage(null);
    setShoppingOfferTarget(null);
    deferredRemoval.scheduleRemoval(item, "consume", amountBase);
  };

  const primaryFooter =
    !showListChrome || isFilteredEmpty ? null : isSelectionMode ? (
      <Button
        variant="danger"
        icon={Trash2}
        onPress={handleConfirmBatchDiscard}
        disabled={!selectedIds.length}
        fullWidth
        testID="inventory-discard-selected-button"
      >
          {selectedIds.length
            ? `${selectedIds.length}개 폐기`
            : "폐기할 재료를 골라 주세요"}
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

  return (
    <Screen
      scroll={false}
      contentWidth="wide"
      bottomInsetMode="navigator"
      testID="inventory-screen"
      footer={primaryFooter}
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
              tintColor={colors.brandAccent}
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
                    inventoryFilterHeroTone === "danger" &&
                      styles.filterToolbarDangerNotice,
                    inventoryFilterHeroTone === "warning" &&
                      styles.filterToolbarWarningNotice,
                    inventoryFilterHeroTone === "success" &&
                      styles.filterToolbarSuccessNotice,
                    inventoryFilterHeroTone === "neutral" &&
                      styles.filterToolbarNeutralNotice,
                  ]}
                >
                  {inventoryFilterHero}
                  <HomeStatsSkeleton />
                </View>
              ) : showListChrome && !isSelectionMode ? (
                <InventoryFilterToolbar
                  heroContent={inventoryFilterHero}
                  heroTone={inventoryFilterHeroTone ?? undefined}
                  shouldStackDense={shouldStackDense}
                  searchQuery={searchQuery}
                  onChangeSearchQuery={setSearchQuery}
                  hasSearchQuery={hasSearchQuery}
                  onEnterSelectionMode={() => enterSelectionMode()}
                  facetCounts={facetCounts}
                  filter={filter}
                  onToggleExpiryFilter={toggleExpiryFilter}
                  hasLocationFilter={hasLocationFilter}
                  selectedLocationLabel={selectedLocationLabel}
                  onOpenLocationFilter={openLocationFilterSheet}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearListFilters}
                />
              ) : showListChrome && isSelectionMode ? (
                <View
                  style={[
                    styles.filterToolbar,
                    inventoryFilterHeroTone === "neutral" &&
                      styles.filterToolbarNeutralNotice,
                  ]}
                >
                  {inventoryFilterHero}
                  <InventorySelectionBar
                    embedded
                    selectedCount={selectedIds.length}
                    visibleCount={visibleIds.length}
                    expiredVisibleCount={expiredVisibleIds.length}
                    onSelectAll={handleSelectAllVisible}
                    onSelectExpired={handleSelectExpiredOnly}
                    onCancel={cancelSelectionMode}
                  />
                </View>
              ) : inventoryFilterHero ? (
                <View
                  style={[
                    styles.filterToolbar,
                    inventoryFilterHeroTone === "danger" &&
                      styles.filterToolbarDangerNotice,
                    inventoryFilterHeroTone === "warning" &&
                      styles.filterToolbarWarningNotice,
                    inventoryFilterHeroTone === "success" &&
                      styles.filterToolbarSuccessNotice,
                    inventoryFilterHeroTone === "neutral" &&
                      styles.filterToolbarNeutralNotice,
                  ]}
                >
                  {inventoryFilterHero}
                </View>
              ) : null}

              {isError && hasLoadedInventory ? (
                <FeedbackBanner
                  tone="danger"
                  title="앗, 보관함을 불러오지 못했어요"
                  description={loadErrorMessage}
                  actionLabel="다시 시도"
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
            ) : isEmptyInventory ? (
              <InventoryEmptyListLayout />
            ) : isFilteredEmpty ? (
              <InventoryEmptyListLayout filtered />
            ) : null
          }
          renderItem={({ item: section }) => (
            <UrgencySection
              section={section}
              collapsed={collapsedSectionKeySet.has(section.key)}
              onToggle={() => toggleSectionCollapsed(section.key)}
            >
              {section.data.map((item, index) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  embedded
                  showDivider={index < section.data.length - 1}
                  selectionMode={isSelectionMode}
                  selected={selectedIdSet.has(item.id)}
                  resolveLocationLabel={resolveLabel}
                  onPress={handleCardPress}
                  onLongPress={(pressedItem) =>
                    handleCardLongPress(pressedItem.id)
                  }
                  onCleanup={openCleanupSheet}
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

      <InventoryQuickEditSheet
        item={quickEditItem}
        resolveLocationLabel={resolveLabel}
        onClose={() => setQuickEditItem(null)}
        onEdit={handleEditItem}
      />

      <InventoryLocationFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        location={location}
        hasLocationFilter={hasLocationFilter}
        facetCounts={facetCounts}
        options={selectableOptions}
        onSelect={selectLocationFilter}
      />

      <IngredientEntryMethodSheet
        visible={entryMethodVisible}
        onClose={() => setEntryMethodVisible(false)}
        onScan={goToScanner}
        onManual={goToManualRegister}
        onPhoto={
          isInventoryPhotoParseEnabled() ? goToPhotoParse : undefined
        }
      />
    </Screen>
  );
}

function InventoryEmptyListLayout({ filtered = false }: { filtered?: boolean }) {
  const title = filtered ? "조건에 맞는 재료 0건" : "보관 중인 재료 0건";
  const description = filtered
    ? "검색어나 필터를 바꾸면 조건에 맞는 재료가 이곳에 보여요."
    : "첫 재료를 넣으면 유통기한 순서에 맞춰 이곳에 차곡차곡 정리해 드릴게요.";

  return (
    <View
      style={styles.emptyInventorySection}
      testID="inventory-empty-list-layout"
      accessible
      accessibilityLabel={`${title}. ${description}`}
    >
      <View style={styles.emptyInventorySectionHeader}>
        <AppText
          variant="bodySmall"
          scaleRole="chrome"
          densityAware={false}
          style={styles.emptyInventorySectionTitle}
        >
          {title}
        </AppText>
      </View>
      <View style={styles.emptyInventorySectionBody}>
        <AppText variant="bodySmall" tone="subtext">
          {description}
        </AppText>
      </View>
    </View>
  );
}
