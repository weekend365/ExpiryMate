import {
  fieldLimits,
  getExpiryTrafficBucket,
  isTrackedItem,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  Barcode,
  CheckSquare,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import fridgeInteriorBg from "../../assets/backgrounds/fridge-interior-bg.png";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import {
  HomeStatsSkeleton,
  InventoryListSkeleton,
} from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryGroupCard } from "../../src/components/InventoryGroupCard";
import { type MascotMood } from "../../src/components/Mascot";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { Screen } from "../../src/components/Screen";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import {
  buildInventoryUrgencySections,
  filterInventoryItems,
  parseInventoryViewFilter,
  type InventoryViewFilter,
} from "../../src/features/inventory/filters";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import { useDeferredDiscardInventoryItem } from "../../src/features/inventory/use-deferred-discard-inventory-item";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useStorageLocations } from "../../src/features/settings/use-storage-locations";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function InventoryScreen() {
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const filterParam = parseInventoryViewFilter(params.filter);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useInventoryList();
  const batchDiscardMutation = useBatchDiscardInventoryItems();
  const deferredDiscard = useDeferredDiscardInventoryItem();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const { selectableOptions, resolveLabel, createMutation } =
    useStorageLocations();
  const [filter, setFilter] = useState<InventoryViewFilter>(
    () => filterParam ?? "all",
  );
  const [location, setLocation] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addLocationVisible, setAddLocationVisible] = useState(false);
  const [entryMethodVisible, setEntryMethodVisible] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const toggleTrafficFilter = (nextFilter: InventoryViewFilter) => {
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
  const flatGroups = useMemo(
    () => urgencySections.flatMap((section) => section.data),
    [urgencySections],
  );
  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    selectableOptions.forEach((option) => {
      counts[option.key] = trackedItems.filter(
        (item) => item.storageLocation === option.key,
      ).length;
    });

    return counts;
  }, [trackedItems, selectableOptions]);

  const hasLocationFilter = location !== "all";
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasStatusFilter = filter !== "all";
  const hasActiveListFilters =
    hasStatusFilter || hasLocationFilter || hasSearchQuery;
  const activeLocationLabel = hasLocationFilter ? resolveLabel(location) : null;
  const trafficStats = useMemo(() => {
    let expiredCount = 0;
    let within7DaysCount = 0;
    let safeCount = 0;

    trackedItems.forEach((item) => {
      const bucket = getExpiryTrafficBucket(item.expiryDate);

      if (bucket === "expired") {
        expiredCount += 1;
      } else if (bucket === "within_7_days") {
        within7DaysCount += 1;
      } else {
        safeCount += 1;
      }
    });

    return {
      expiredCount,
      within7DaysCount,
      safeCount,
      totalTrackedCount: trackedItems.length,
    };
  }, [trackedItems]);

  const companion = useMemo(() => {
    if (deferredDiscard.undoLabel || successMessage) {
      return {
        mood: "happy" as MascotMood,
        message: "잘 정리하고 있어요. 장고도 한숨 돌렸어요.",
      };
    }

    if (trafficStats.expiredCount > 0) {
      return {
        mood: "worry" as MascotMood,
        message: "유통기한이 지난 재료가 있어요. 먼저 정리해 볼까요?",
      };
    }

    if (
      trafficStats.totalTrackedCount > 0 &&
      trafficStats.within7DaysCount === 0
    ) {
      return {
        mood: "happy" as MascotMood,
        message: "지금은 여유로워요. 냉장고가 한산해서 장고도 편해요.",
      };
    }

    return null;
  }, [
    deferredDiscard.undoLabel,
    successMessage,
    trafficStats.expiredCount,
    trafficStats.totalTrackedCount,
    trafficStats.within7DaysCount,
  ]);

  const selectCompartment = (next: string | "all") => {
    setLocation((current) =>
      next !== "all" && current === next ? "all" : next,
    );
  };

  const handleCreateLocation = () => {
    createMutation.mutate(
      { label: newLocationLabel },
      {
        onSuccess: (created) => {
          setAddLocationVisible(false);
          setNewLocationLabel("");
          setLocation(created.key);
          Alert.alert("위치를 만들었어요", "이제 이 위치만 볼 수 있어요.");
        },
        onError: (error) =>
          Alert.alert(
            "앗, 잠시 문제가 생겼어요",
            getSettingsErrorMessage(error),
          ),
      },
    );
  };

  // Only treat as empty after a successful load — never during loading/error.
  const isEmptyInventory =
    hasLoadedInventory && !isError && trackedItems.length === 0;
  const isFilteredEmpty = !isEmptyInventory && filtered.length === 0;
  const showListChrome = hasLoadedInventory && !isError && !isEmptyInventory;
  const soloGroupId =
    flatGroups.length === 1 ? (flatGroups[0]?.id ?? null) : null;

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);

    setSelectedIds((current) => {
      const nextIds = current.filter((id) => visibleIdSet.has(id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [visibleIds]);

  // Single matching group: open lots by default so the next action is obvious.
  useEffect(() => {
    if (!soloGroupId) {
      return;
    }

    setExpandedGroupIds((current) =>
      current.includes(soloGroupId) ? current : [...current, soloGroupId],
    );
  }, [soloGroupId, filter, location, searchQuery]);

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
    setIsSelectionMode(true);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredDiscard.clearError();
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

  const handleToggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  };

  const handleCardPress = (id: string) => {
    if (isSelectionMode) {
      toggleSelectedId(id);
      return;
    }

    router.push({
      pathname: "/inventory/[id]",
      params: { id },
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
    deferredDiscard.clearError();
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
    setSuccessMessage(null);
    setActionErrorMessage(null);
    void deferredDiscard.scheduleDiscard(item);
  };

  return (
    <Screen
      scroll={false}
      contentWidth="wide"
      footer={
        !showListChrome || isFilteredEmpty ? null : isSelectionMode ? (
          <Button
            variant="danger"
            icon={Trash2}
            onPress={handleConfirmBatchDiscard}
            loading={batchDiscardMutation.isPending}
            disabled={!selectedIds.length}
            fullWidth
          >
            {selectedIds.length
              ? `${selectedIds.length}개 정리할게요`
              : "정리할 재료를 골라 주세요"}
          </Button>
        ) : (
          <Button icon={Plus} onPress={openEntryMethodSheet} fullWidth>
            재료 넣으러 가기
          </Button>
        )
      }
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
                <View style={styles.chromeStack}>
                  {companion ? (
                    <MascotSpeechBubble
                      message={companion.message}
                      mood={companion.mood}
                      size="small"
                      style={styles.companionBubble}
                    />
                  ) : null}

                  <View style={styles.filterPanel}>
                    <View style={styles.filterTopRow}>
                      <TrafficLightFilter
                        expiredCount={trafficStats.expiredCount}
                        within7Count={trafficStats.within7DaysCount}
                        safeCount={trafficStats.safeCount}
                        activeFilter={filter}
                        onToggleExpired={() => toggleTrafficFilter("expired")}
                        onToggleWithin7={() => toggleTrafficFilter("within7")}
                        onToggleSafe={() => toggleTrafficFilter("safe")}
                      />
                      <View style={styles.filterIconActions}>
                        <Pressable
                          onPress={clearListFilters}
                          disabled={!hasActiveListFilters}
                          hitSlop={spacing.xs}
                          style={({ pressed }) => [
                            styles.headerIconButton,
                            pressed && styles.headerFilterButtonPressed,
                            !hasActiveListFilters &&
                              styles.headerIconButtonDisabled,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="조건 모두 풀기"
                          accessibilityHint="신호등·위치·검색 조건을 모두 풀고 전체를 보여 드릴게요."
                          accessibilityState={{
                            disabled: !hasActiveListFilters,
                          }}
                        >
                          <RefreshCw
                            color={
                              hasActiveListFilters
                                ? colors.primary
                                : colors.mutedText
                            }
                            size={spacing.md}
                            strokeWidth={2.4}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => enterSelectionMode()}
                          hitSlop={spacing.xs}
                          style={({ pressed }) => [
                            styles.headerIconButton,
                            pressed && styles.headerFilterButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="고르기"
                          accessibilityHint="여러 재료를 골라 한 번에 정리할 수 있어요."
                        >
                          <CheckSquare
                            color={colors.primary}
                            size={spacing.md}
                            strokeWidth={2.4}
                          />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.trafficGuideCaption}>
                      빨강(만료됨)·노랑(7일 이내)·초록(여유) 램프를 누르면
                      해당 재료만 보관함에서 보여드려요.
                    </Text>

                    <View style={styles.searchField}>
                      <Search
                        color={colors.mutedText}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.4}
                      />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="찾아보기"
                        placeholderTextColor={colors.mutedText}
                        accessibilityLabel="재료 이름 검색"
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        style={styles.searchInput}
                      />
                      {hasSearchQuery ? (
                        <Pressable
                          onPress={() => setSearchQuery("")}
                          hitSlop={spacing.xs}
                          accessibilityRole="button"
                          accessibilityLabel="검색어 지우기"
                          style={({ pressed }) => [
                            styles.searchClearButton,
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

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.compartmentRail}
                    >
                      <Pressable
                        onPress={() => selectCompartment("all")}
                        hitSlop={spacing.xxs}
                        accessibilityRole="button"
                        accessibilityState={{ selected: location === "all" }}
                        accessibilityLabel={`전체 위치, ${trackedItems.length}개`}
                        style={({ pressed }) => [
                          styles.compartmentChip,
                          location === "all" && styles.compartmentChipSelected,
                          pressed && styles.headerFilterButtonPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.compartmentChipLabel,
                            location === "all" &&
                              styles.compartmentChipLabelSelected,
                          ]}
                        >
                          전체
                        </Text>
                        <Text
                          style={[
                            styles.compartmentChipCount,
                            location === "all" &&
                              styles.compartmentChipCountSelected,
                          ]}
                        >
                          {trackedItems.length}
                        </Text>
                      </Pressable>
                      {selectableOptions.map((option) => {
                        const selected = location === option.key;
                        const count = locationCounts[option.key] ?? 0;

                        return (
                          <Pressable
                            key={option.key}
                            onPress={() => selectCompartment(option.key)}
                            onLongPress={() => {
                              if (!option.readonly) {
                                router.push("/settings/storage-locations");
                              }
                            }}
                            hitSlop={spacing.xxs}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${option.label}, ${count}개`}
                            accessibilityHint={
                              selected
                                ? "다시 누르면 전체 위치로 돌아가요."
                                : `${option.label}만 보여 드릴게요.`
                            }
                            style={({ pressed }) => [
                              styles.compartmentChip,
                              selected && styles.compartmentChipSelected,
                              pressed && styles.headerFilterButtonPressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.compartmentChipLabel,
                                selected && styles.compartmentChipLabelSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                            <Text
                              style={[
                                styles.compartmentChipCount,
                                selected && styles.compartmentChipCountSelected,
                              ]}
                            >
                              {count}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={() => {
                          setNewLocationLabel("");
                          setAddLocationVisible(true);
                        }}
                        hitSlop={spacing.xxs}
                        accessibilityRole="button"
                        accessibilityLabel="위치 추가"
                        accessibilityHint="나만의 보관 위치를 만들어요."
                        style={({ pressed }) => [
                          styles.compartmentChip,
                          styles.compartmentChipAdd,
                          pressed && styles.headerFilterButtonPressed,
                        ]}
                      >
                        <Plus
                          color={colors.primary}
                          size={spacing.sm}
                          strokeWidth={2.4}
                        />
                        <Text style={styles.compartmentChipAddLabel}>
                          위치 추가
                        </Text>
                      </Pressable>
                    </ScrollView>

                    {hasActiveListFilters ? (
                      <View
                        style={styles.activeFiltersBlock}
                        accessibilityRole="summary"
                        accessibilityLabel="지금 적용된 조건"
                      >
                        <Text style={styles.activeFiltersLabel}>
                          지금 보는 중
                        </Text>
                        <View style={styles.activeFiltersRow}>
                          {hasStatusFilter ? (
                            <Pressable
                              onPress={() => applyFilter("all")}
                              hitSlop={spacing.xxs}
                              accessibilityRole="button"
                              accessibilityLabel={`${getActiveStatusFilterLabel(filter)} 조건 풀기`}
                              style={({ pressed }) => [
                                styles.activeFilterChip,
                                pressed && styles.headerFilterButtonPressed,
                              ]}
                            >
                              <Text style={styles.activeFilterChipLabel}>
                                {getActiveStatusFilterLabel(filter)}
                              </Text>
                              <X
                                color={colors.primary}
                                size={spacing.sm}
                                strokeWidth={2.4}
                              />
                            </Pressable>
                          ) : null}
                          {hasLocationFilter && activeLocationLabel ? (
                            <Pressable
                              onPress={() => setLocation("all")}
                              hitSlop={spacing.xxs}
                              accessibilityRole="button"
                              accessibilityLabel={`${activeLocationLabel} 조건 풀기`}
                              style={({ pressed }) => [
                                styles.activeFilterChip,
                                pressed && styles.headerFilterButtonPressed,
                              ]}
                            >
                              <Text style={styles.activeFilterChipLabel}>
                                {activeLocationLabel}
                              </Text>
                              <X
                                color={colors.primary}
                                size={spacing.sm}
                                strokeWidth={2.4}
                              />
                            </Pressable>
                          ) : null}
                          {hasSearchQuery ? (
                            <Pressable
                              onPress={() => setSearchQuery("")}
                              hitSlop={spacing.xxs}
                              accessibilityRole="button"
                              accessibilityLabel={`검색어 ${searchQuery.trim()} 지우기`}
                              style={({ pressed }) => [
                                styles.activeFilterChip,
                                pressed && styles.headerFilterButtonPressed,
                              ]}
                            >
                              <Text
                                style={styles.activeFilterChipLabel}
                                numberOfLines={1}
                              >
                                {searchQuery.trim()}
                              </Text>
                              <X
                                color={colors.primary}
                                size={spacing.sm}
                                strokeWidth={2.4}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : showListChrome && isSelectionMode ? (
                <View
                  style={styles.selectionRow}
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={
                    selectedIds.length
                      ? `${selectedIds.length}개 골랐어요`
                      : "고르기 모드예요. 정리할 재료를 눌러 주세요."
                  }
                >
                  <View style={styles.selectionSummary}>
                    <Text style={styles.selectionTitle} numberOfLines={1}>
                      {selectedIds.length
                        ? `${selectedIds.length}개 골랐어요`
                        : "정리할 재료를 눌러 주세요"}
                    </Text>
                  </View>
                  <View style={styles.headerActions}>
                    <Pressable
                      onPress={handleToggleAllVisible}
                      disabled={!visibleIds.length}
                      hitSlop={spacing.xs}
                      accessibilityRole="button"
                      accessibilityLabel={
                        allVisibleSelected ? "전부 해제" : "전부 고르기"
                      }
                      style={({ pressed }) => [
                        styles.headerFilterButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                    >
                      <Text style={styles.headerFilterLabel}>
                        {allVisibleSelected ? "전부 해제" : "전부 고르기"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={cancelSelectionMode}
                      hitSlop={spacing.xs}
                      style={({ pressed }) => [
                        styles.headerFilterButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="고르기 그만두기"
                    >
                      <Text style={styles.headerFilterLabel}>그만두기</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {deferredDiscard.undoLabel ? (
                <FeedbackBanner
                  tone="success"
                  title={deferredDiscard.undoLabel}
                  description="잘못 눌렀다면 바로 되돌릴 수 있어요."
                  actionLabel="되돌릴게요"
                  onAction={deferredDiscard.undoDiscard}
                />
              ) : successMessage ? (
                <FeedbackBanner tone="success" title={successMessage} />
              ) : null}

              {deferredDiscard.errorMessage || actionErrorMessage ? (
                <FeedbackBanner
                  tone="danger"
                  title="앗, 잠시 문제가 생겼어요"
                  description={
                    deferredDiscard.errorMessage ??
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
                      : "전체 보관함 볼게요"
                }
                onAction={
                  hasSearchQuery && !hasStatusFilter && !hasLocationFilter
                    ? () => setSearchQuery("")
                    : clearListFilters
                }
                accessory={
                  <Button
                    variant="secondary"
                    onPress={openEntryMethodSheet}
                    fullWidth
                  >
                    재료 넣으러 가기
                  </Button>
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
              isDiscarding={deferredDiscard.isPending}
              resolveLocationLabel={resolveLabel}
              onItemPress={(item) => handleCardPress(item.id)}
              onItemLongPress={(item) => handleCardLongPress(item.id)}
              onItemDiscard={handleDiscard}
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.urgencySectionTitle}>{section.title}</Text>
          )}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
      </View>

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

      <BottomSheet
        visible={addLocationVisible}
        onClose={() => setAddLocationVisible(false)}
        title="어디에 둘까요?"
        description="위치 이름을 알려 주시면 목록에 넣어 둘게요."
        mascotMood="idle"
        footer={
          <Button
            onPress={handleCreateLocation}
            loading={createMutation.isPending}
            disabled={newLocationLabel.trim().length === 0}
            fullWidth
          >
            여기에 보관할까요?
          </Button>
        }
      >
        <View style={styles.addLocationField}>
          <Text style={styles.addLocationLabel}>위치 이름</Text>
          <TextInput
            value={newLocationLabel}
            onChangeText={setNewLocationLabel}
            placeholder="예: 팬트리"
            placeholderTextColor={colors.mutedText}
            maxLength={fieldLimits.storageLocationLabel}
            autoFocus
            style={styles.addLocationInput}
          />
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

function getActiveStatusFilterLabel(filter: InventoryViewFilter) {
  if (filter === "within7") {
    return "7일 이내";
  }

  if (filter === "expired") {
    return "만료됨";
  }

  if (filter === "safe") {
    return "여유";
  }

  return "전체";
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

const TRAFFIC_LAMP_SIZE = touchTarget.min;
const TRAFFIC_LAMP_OFF_OPACITY = 0.28;

function TrafficLightFilter({
  expiredCount,
  within7Count,
  safeCount,
  activeFilter,
  onToggleExpired,
  onToggleWithin7,
  onToggleSafe,
}: {
  expiredCount: number;
  within7Count: number;
  safeCount: number;
  activeFilter: InventoryViewFilter;
  onToggleExpired: () => void;
  onToggleWithin7: () => void;
  onToggleSafe: () => void;
}) {
  return (
    <View
      style={styles.trafficHousing}
      accessibilityRole="summary"
      accessibilityLabel={`만료됨 ${expiredCount}개, 7일 이내 ${within7Count}개, 여유 ${safeCount}개`}
    >
      <TrafficLamp
        label="만료됨"
        count={expiredCount}
        tone="danger"
        selected={activeFilter === "expired"}
        onPress={onToggleExpired}
        accessibilityHint={
          activeFilter === "expired"
            ? "다시 누르면 전체 목록으로 돌아가요."
            : "유통기한이 지난 재료만 보여 드릴게요."
        }
      />
      <TrafficLamp
        label="7일 이내"
        count={within7Count}
        tone="warning"
        selected={activeFilter === "within7"}
        onPress={onToggleWithin7}
        accessibilityHint={
          activeFilter === "within7"
            ? "다시 누르면 전체 목록으로 돌아가요."
            : "7일 안에 손볼 재료만 보여 드릴게요."
        }
      />
      <TrafficLamp
        label="여유"
        count={safeCount}
        tone="success"
        selected={activeFilter === "safe"}
        onPress={onToggleSafe}
        accessibilityHint={
          activeFilter === "safe"
            ? "다시 누르면 전체 목록으로 돌아가요."
            : "유통기한이 8일 이상 남은 재료만 보여 드릴게요."
        }
      />
    </View>
  );
}

function TrafficLamp({
  label,
  count,
  tone,
  selected,
  onPress,
  accessibilityHint,
}: {
  label: string;
  count: number;
  tone: "danger" | "warning" | "success";
  selected: boolean;
  onPress: () => void;
  accessibilityHint: string;
}) {
  const lamp = trafficLampPalettes[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${count}개`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.trafficLampHit,
        pressed && styles.trafficLampHitPressed,
      ]}
    >
      <View
        style={[
          styles.trafficLamp,
          selected && {
            shadowColor: lamp.glow,
            ...styles.trafficLampGlow,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.trafficLampFill,
            {
              backgroundColor: lamp.onBackground,
              opacity: selected ? 1 : TRAFFIC_LAMP_OFF_OPACITY,
            },
          ]}
        />
        <Text
          style={[
            styles.trafficLampCount,
            { color: selected ? lamp.onText : lamp.onBackground },
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const trafficLampPalettes = {
  danger: {
    onBackground: colors.danger,
    onText: colors.surface,
    glow: colors.danger,
  },
  warning: {
    onBackground: colors.warning,
    onText: colors.surface,
    glow: colors.warning,
  },
  success: {
    onBackground: colors.success,
    onText: colors.surface,
    glow: colors.success,
  },
} as const;

const styles = StyleSheet.create({
  chromeStack: {
    gap: spacing.sm,
  },
  filterPanel: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: touchTarget.min,
  },
  filterIconActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: spacing.xxs,
  },
  trafficHousing: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: spacing.xxs,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  trafficLampHit: {
    width: TRAFFIC_LAMP_SIZE,
    height: TRAFFIC_LAMP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  trafficLampHitPressed: {
    opacity: 0.85,
  },
  trafficLamp: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  trafficLampFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
  trafficLampGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: spacing.xs,
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  trafficLampCount: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
  },
  companionBubble: {
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  compartmentRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  compartmentChip: {
    // Selection chip: compact rectangle; rail hit area stays near 48 via padding.
    minHeight: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  compartmentChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  compartmentChipLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  compartmentChipLabelSelected: {
    color: colors.primary,
  },
  compartmentChipCount: {
    minWidth: spacing.md,
    overflow: "hidden",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    textAlign: "center",
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.subtext,
    backgroundColor: colors.mutedSurface,
  },
  compartmentChipCountSelected: {
    color: colors.primary,
    backgroundColor: colors.surface,
  },
  compartmentChipAdd: {
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  compartmentChipAddLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  entryMethodActions: {
    gap: spacing.xs,
  },
  addLocationField: {
    gap: spacing.xs,
  },
  addLocationLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  addLocationInput: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
  },
  trafficGuideCaption: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
    paddingHorizontal: spacing.xxs,
  },
  activeFiltersBlock: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  activeFiltersLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  activeFiltersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  activeFilterChip: {
    minHeight: spacing.xl,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  activeFilterChipLabel: {
    flexShrink: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
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
    paddingVertical: spacing.xs,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  searchClearButton: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: spacing.xxs,
  },
  headerIconButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  headerIconButtonDisabled: {
    opacity: 0.45,
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
    paddingVertical: spacing.sm,
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl + spacing.sm,
  },
  listHeader: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  urgencySectionTitle: {
    ...typography.bodySmall,
    color: colors.subtext,
    fontWeight: "700",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  itemSeparator: {
    height: spacing.xs,
  },
});
