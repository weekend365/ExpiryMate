import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  getExpiryBucket,
  groupInventoryItems,
  ItemStatus,
  StorageLocation,
  storageLocationLabels,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  CheckSquare,
  Eye,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppText } from "../../src/components/AppText";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import {
  HomeStatsSkeleton,
  InventoryListSkeleton,
} from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryGroupCard } from "../../src/components/InventoryGroupCard";
import { ListRow } from "../../src/components/ListRow";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatCard } from "../../src/components/StatCard";
import {
  filterInventoryItems,
  parseInventoryViewFilter,
  type InventoryViewFilter,
} from "../../src/features/inventory/filters";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import { useDeferredDiscardInventoryItem } from "../../src/features/inventory/use-deferred-discard-inventory-item";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { colors, radius, spacing, touchTarget, typography } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function InventoryScreen() {
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const filterParam = parseInventoryViewFilter(params.filter);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInventoryList();
  const batchDiscardMutation = useBatchDiscardInventoryItems();
  const deferredDiscard = useDeferredDiscardInventoryItem();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const [filter, setFilter] = useState<InventoryViewFilter>(
    () => filterParam ?? "all",
  );
  const [location, setLocation] = useState<StorageLocation | "all">("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [menuItem, setMenuItem] = useState<InventoryItem | null>(null);
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

  const activeItems = useMemo(
    () => (data ?? []).filter((item) => item.status === ItemStatus.ACTIVE),
    [data],
  );
  const activeGroups = useMemo(
    () => groupInventoryItems(activeItems),
    [activeItems],
  );

  const filtered = useMemo(
    () => filterInventoryItems(activeItems, filter, location),
    [activeItems, filter, location],
  );
  const filteredGroups = useMemo(
    () => groupInventoryItems(filtered),
    [filtered],
  );
  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const locationCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.values(StorageLocation).map((value) => [value, 0]),
    ) as Record<StorageLocation, number>;

    Object.values(StorageLocation).forEach((storageLocation) => {
      counts[storageLocation] = groupInventoryItems(
        activeItems.filter((item) => item.storageLocation === storageLocation),
      ).length;
    });

    return counts;
  }, [activeItems]);

  const trafficStats = useMemo(() => {
    let todayExpiryCount = 0;
    let within7DaysCount = 0;

    activeItems.forEach((item) => {
      const bucket = getExpiryBucket(item.expiryDate);
      const daysLeft = calculateDaysLeftUntilExpiry(item.expiryDate);

      if (bucket === "today") {
        todayExpiryCount += 1;
      }

      if (daysLeft >= 0 && daysLeft <= 7) {
        within7DaysCount += 1;
      }
    });

    return {
      todayExpiryCount,
      within7DaysCount,
      totalActiveCount: activeItems.length,
    };
  }, [activeItems]);

  const activeLocationLabel =
    location === "all" ? "모든 위치" : storageLocationLabels[location];
  const hasLocationFilter = location !== "all";
  const trafficFilterCaption = getTrafficFilterCaption(
    filter,
    filteredGroups.length,
  );
  // Only treat as empty after a successful load — never during loading/error.
  const isEmptyInventory =
    hasLoadedInventory && !isError && activeItems.length === 0;
  const isFilteredEmpty = !isEmptyInventory && filtered.length === 0;
  const showListChrome = hasLoadedInventory && !isError && !isEmptyInventory;

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);

    setSelectedIds((current) => {
      const nextIds = current.filter((id) => visibleIdSet.has(id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [visibleIds]);

  const goToRegister = () => {
    clearPrefill();
    router.push("/register");
  };

  const enterSelectionMode = (initialId?: string) => {
    setIsSelectionMode(true);
    setIsFilterSheetOpen(false);
    setMenuItem(null);
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

  const handleOpenItemMenu = (item: InventoryItem) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    setMenuItem(item);
  };

  const handleMenuViewDetail = () => {
    if (!menuItem) {
      return;
    }

    const id = menuItem.id;
    setMenuItem(null);
    router.push({
      pathname: "/inventory/[id]",
      params: { id },
    });
  };

  const handleMenuStartSelection = () => {
    if (!menuItem) {
      return;
    }

    enterSelectionMode(menuItem.id);
  };

  const handleMenuDiscard = () => {
    if (!menuItem) {
      return;
    }

    const item = menuItem;
    setMenuItem(null);
    void deferredDiscard.scheduleDiscard(item);
  };

  const handleConfirmBatchDiscard = () => {
    if (!selectedIds.length) {
      return;
    }

    Alert.alert(
      "이 재료들을 정리할까요?",
      "정리하면 보관함 목록에서 사라져요. 장고가 기억해 둘게요.",
      [
        { text: "조금만 더 둘래요", style: "cancel" },
        {
          text: "정리할게요",
          style: "destructive",
          onPress: async () => {
            try {
              setActionErrorMessage(null);
              deferredDiscard.clearError();
              const result = await batchDiscardMutation.mutateAsync(selectedIds);
              setSuccessMessage(
                `${result.count}개 재료를 정리했어요. 장고도 한숨 돌렸어요.`,
              );
              setSelectedIds([]);
              setIsSelectionMode(false);
            } catch (error) {
              setActionErrorMessage(
                error instanceof Error
                  ? error.message
                  : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
              );
            }
          },
        },
      ],
    );
  };

  const handleDiscard = (item: InventoryItem) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    void deferredDiscard.scheduleDiscard(item);
  };

  return (
    <Screen
      scroll={false}
      footer={
        !showListChrome || isFilteredEmpty
          ? null
          : isSelectionMode
            ? (
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
            )
            : (
              <Button icon={Plus} onPress={goToRegister} fullWidth>
                재료 넣으러 가기
              </Button>
            )
      }
      contentStyle={styles.screenContent}
    >
      <FlatList
        style={styles.listFlex}
        data={
          isLoading && !hasLoadedInventory
            ? []
            : isError && !hasLoadedInventory
              ? []
              : isEmptyInventory || isFilteredEmpty
                ? []
                : filteredGroups
        }
        keyExtractor={(group) => group.id}
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
            {showListChrome ? (
              <View style={styles.actionBar}>
                {isSelectionMode ? (
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
                ) : (
                  <View style={styles.headerActions}>
                    <Pressable
                      onPress={() => enterSelectionMode()}
                      hitSlop={spacing.xs}
                      style={({ pressed }) => [
                        styles.headerFilterButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="고르기"
                      accessibilityHint="여러 재료를 골라 한 번에 정리할 수 있어요."
                    >
                      <CheckSquare
                        color={colors.primary}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.headerFilterLabel}>고르기</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIsFilterSheetOpen(true)}
                      hitSlop={spacing.xs}
                      style={({ pressed }) => [
                        styles.headerFilterButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="위치 고르기"
                      accessibilityHint="보관 위치로 목록을 골라 볼 수 있어요."
                    >
                      <MapPin
                        color={colors.primary}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.headerFilterLabel}>위치</Text>
                    </Pressable>
                  </View>
                )}
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
                  deferredDiscard.errorMessage ?? actionErrorMessage ?? undefined
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

            {isLoading && !hasLoadedInventory ? (
              <HomeStatsSkeleton />
            ) : hasLoadedInventory && !isError && !isSelectionMode ? (
              <View style={styles.trafficGroup}>
                <View
                  style={styles.trafficStrip}
                  accessibilityRole="summary"
                  accessibilityLabel={`오늘 만료 ${trafficStats.todayExpiryCount}개, 7일 이내 ${trafficStats.within7DaysCount}개, 보관 중 ${trafficStats.totalActiveCount}개`}
                >
                  <Pressable
                    style={styles.trafficLampPressable}
                    onPress={() => toggleTrafficFilter("today")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === "today" }}
                    accessibilityLabel={`오늘 만료 ${trafficStats.todayExpiryCount}개`}
                    accessibilityHint={
                      filter === "today"
                        ? "다시 누르면 전체 목록으로 돌아가요."
                        : "오늘 만료되는 재료만 보여 드릴게요."
                    }
                  >
                    <StatCard
                      variant="traffic"
                      label="오늘 만료"
                      value={trafficStats.todayExpiryCount}
                      tone="danger"
                      showLabel={false}
                      selected={filter === "today"}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.trafficLampPressable}
                    onPress={() => toggleTrafficFilter("within7")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === "within7" }}
                    accessibilityLabel={`7일 이내 ${trafficStats.within7DaysCount}개`}
                    accessibilityHint={
                      filter === "within7"
                        ? "다시 누르면 전체 목록으로 돌아가요."
                        : "7일 안에 손볼 재료만 보여 드릴게요."
                    }
                  >
                    <StatCard
                      variant="traffic"
                      label="7일 이내"
                      value={trafficStats.within7DaysCount}
                      tone="warning"
                      showLabel={false}
                      selected={filter === "within7"}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.trafficLampPressable}
                    onPress={() => applyFilter("all")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === "all" }}
                    accessibilityLabel={`보관 중 ${trafficStats.totalActiveCount}개`}
                    accessibilityHint="전체 보관 재료를 보여 드릴게요."
                  >
                    <StatCard
                      variant="traffic"
                      label="보관 중"
                      value={trafficStats.totalActiveCount}
                      tone="success"
                      showLabel={false}
                      selected={filter === "all"}
                    />
                  </Pressable>
                </View>
                <View
                  style={styles.trafficLabels}
                  importantForAccessibility="no-hide-descendants"
                >
                  <AppText
                    variant="caption"
                    tone="subtext"
                    style={styles.trafficLabel}
                  >
                    오늘 만료
                  </AppText>
                  <AppText
                    variant="caption"
                    tone="subtext"
                    style={styles.trafficLabel}
                  >
                    7일 이내
                  </AppText>
                  <AppText
                    variant="caption"
                    tone="subtext"
                    style={styles.trafficLabel}
                  >
                    보관 중
                  </AppText>
                </View>
                <Text style={styles.trafficCaption}>{trafficFilterCaption}</Text>
              </View>
            ) : null}

            {showListChrome && !isSelectionMode ? (
              <Pressable
                onPress={() => setIsFilterSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="보관 위치 고르기"
                accessibilityHint="냉장, 냉동 같은 위치로 목록을 골라 볼 수 있어요."
                style={({ pressed }) => [
                  styles.filterSummary,
                  pressed && styles.filterSummaryPressed,
                ]}
              >
                <View style={styles.filterSummaryCopy}>
                  <Text style={styles.filterSummaryLabel}>지금 보는 위치</Text>
                  <Text style={styles.filterSummaryValue}>
                    {activeLocationLabel}
                    {hasLocationFilter ? "" : " · 가까운 순"}
                  </Text>
                </View>
                <Text style={styles.filterSummaryAction}>바꾸기</Text>
              </Pressable>
            ) : null}

            {isSelectionMode ? (
              <View
                style={styles.selectionStrip}
                accessibilityLiveRegion="polite"
                accessibilityLabel={
                  selectedIds.length
                    ? `${selectedIds.length}개 골랐어요`
                    : "고르기 모드예요. 정리할 재료를 눌러 주세요."
                }
              >
                <Mascot size="small" mood="worry" />
                <View style={styles.selectionCopy}>
                  <Text style={styles.selectionTitle}>
                    {selectedIds.length
                      ? `${selectedIds.length}개 골랐어요`
                      : "정리할 재료를 눌러 주세요"}
                  </Text>
                  <Text style={styles.selectionDescription}>
                    고르기 모드예요. 아래에서 한 번에 정리할 수 있어요.
                  </Text>
                </View>
                <Pressable
                  onPress={handleToggleAllVisible}
                  disabled={!visibleIds.length}
                  accessibilityRole="button"
                  accessibilityLabel={
                    allVisibleSelected ? "전부 해제" : "전부 고르기"
                  }
                  style={({ pressed }) => [
                    styles.selectionToggle,
                    pressed && styles.headerFilterButtonPressed,
                  ]}
                >
                  <Text style={styles.headerFilterLabel}>
                    {allVisibleSelected ? "전부 해제" : "전부 고르기"}
                  </Text>
                </Pressable>
              </View>
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
              onAction={goToRegister}
            />
          ) : isFilteredEmpty ? (
            <EmptyState
              mood="worry"
              title={getFilteredEmptyTitle(filter)}
              description={getFilteredEmptyDescription(filter, hasLocationFilter)}
              actionLabel={
                filter === "all" && hasLocationFilter
                  ? "모든 위치 볼게요"
                  : "전체 보관함 볼게요"
              }
              onAction={() => {
                if (filter !== "all") {
                  applyFilter("all");
                }
                if (hasLocationFilter) {
                  setLocation("all");
                }
              }}
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
            onItemPress={(item) => handleCardPress(item.id)}
            onItemLongPress={(item) => handleCardLongPress(item.id)}
            onItemMenuPress={handleOpenItemMenu}
            onItemDiscard={handleDiscard}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      />

      <BottomSheet
        visible={Boolean(menuItem)}
        onClose={() => setMenuItem(null)}
        mascotMood="idle"
        title={menuItem?.displayName ?? "이 재료를 어떻게 할까요?"}
        description={
          menuItem
            ? `${formatDateKoreanCompact(menuItem.expiryDate)} · ${menuItem.quantity}${menuItem.unit ?? "개"} 보관 중이에요.`
            : "자세히 보거나, 골라서 정리할 수 있어요."
        }
      >
        <View style={styles.menuList}>
          <ListRow
            title="자세히 볼게요"
            description="유통기한과 메모를 살펴봐요."
            icon={Eye}
            onPress={handleMenuViewDetail}
          />
          <ListRow
            title="고르기 시작할게요"
            description="여러 개를 모아 한 번에 정리해요."
            icon={CheckSquare}
            onPress={handleMenuStartSelection}
          />
          <ListRow
            title="정리할게요"
            description="목록에서 바로 치울게요. 잠시 되돌릴 수 있어요."
            icon={Trash2}
            destructive
            last
            onPress={handleMenuDiscard}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        mascotMood="idle"
        title="어디에 둔 재료를 볼까요?"
        description="보관 위치만 고르면 목록을 바로 바꿔 드릴게요."
        footer={
          <View style={styles.sheetFooter}>
            {activeItems.length ? (
              <Button
                variant="secondary"
                onPress={() => enterSelectionMode()}
                fullWidth
              >
                여러 개 골라서 정리
              </Button>
            ) : null}
            <Button onPress={() => setIsFilterSheetOpen(false)} fullWidth>
              이걸로 볼게요
            </Button>
          </View>
        }
      >
        <View style={styles.sheetSection}>
          <SectionHeader
            title="위치"
            description="어디에 둔 재료인지 골라 주세요."
          />
          <View style={styles.pillRow}>
            <Pill
              label="전체 위치"
              icon={MapPin}
              count={activeGroups.length}
              selected={location === "all"}
              onPress={() => setLocation("all")}
            />
            {Object.values(StorageLocation).map((value) => (
              <Pill
                key={value}
                label={storageLocationLabels[value]}
                count={locationCounts[value]}
                selected={location === value}
                onPress={() => setLocation(value)}
              />
            ))}
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function getTrafficFilterCaption(
  filter: InventoryViewFilter,
  visibleGroupCount: number,
) {
  if (filter === "today") {
    return `오늘 만료 ${visibleGroupCount}개만 보여드릴게요`;
  }

  if (filter === "within7") {
    return `7일 이내 ${visibleGroupCount}개만 보여드릴게요`;
  }

  if (filter === "expired") {
    return `만료된 재료 ${visibleGroupCount}개만 보여드릴게요`;
  }

  return `보관 중 ${visibleGroupCount}개를 가까운 순으로 보여드릴게요`;
}

function getFilteredEmptyTitle(filter: InventoryViewFilter) {
  if (filter === "today") {
    return "오늘 만료되는 재료가 없어요";
  }

  if (filter === "within7") {
    return "7일 안에 손볼 재료가 없어요";
  }

  if (filter === "expired") {
    return "만료된 재료가 없어요";
  }

  return "이 위치에는 재료가 없어요";
}

function getFilteredEmptyDescription(
  filter: InventoryViewFilter,
  hasLocationFilter: boolean,
) {
  if (filter === "today") {
    return hasLocationFilter
      ? "위치를 넓히거나 전체 보관함을 둘러볼까요?"
      : "여유 있을 때 전체 보관함을 천천히 둘러볼 수 있어요.";
  }

  if (filter === "within7") {
    return hasLocationFilter
      ? "위치를 넓히거나 전체 보관함을 둘러볼까요?"
      : "급한 재료가 없으면 전체 목록에서 여유 있게 볼 수 있어요.";
  }

  if (hasLocationFilter) {
    return "다른 위치를 고르거나 전체 보관함을 볼까요?";
  }

  return "조건을 조금 넓히거나, 새 재료를 넣어볼까요?";
}

const styles = StyleSheet.create({
  actionBar: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  headerFilterButton: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.icon,
    paddingHorizontal: spacing.xs,
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
  filterSummary: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  filterSummaryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  filterSummaryCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  filterSummaryLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  filterSummaryValue: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  filterSummaryAction: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  trafficGroup: {
    gap: spacing.xs,
  },
  trafficStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  trafficLampPressable: {
    flex: 1,
    alignItems: "center",
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  trafficLabels: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  trafficLabel: {
    flex: 1,
    textAlign: "center",
  },
  trafficCaption: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  screenContent: {
    flex: 1,
    gap: spacing.none,
    paddingBottom: spacing.none,
  },
  listFlex: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl + spacing.sm,
    gap: spacing.sm,
  },
  listHeader: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listSeparator: {
    height: spacing.sm,
  },
  sheetSection: {
    gap: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sheetFooter: {
    gap: spacing.sm,
  },
  menuList: {
    marginHorizontal: -spacing.md,
  },
  selectionStrip: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget.min,
  },
  selectionCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  selectionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  selectionDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  selectionToggle: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.icon,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
});
