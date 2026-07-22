import {
  ItemStatus,
  StorageLocation,
  storageLocationLabels,
  type InventoryItem,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  Archive,
  CheckSquare,
  CircleAlert,
  Clock3,
  Eye,
  MapPin,
  Plus,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
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
import { Swipeable } from "react-native-gesture-handler";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { InventoryListSkeleton } from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryCard } from "../../src/components/InventoryCard";
import { ListRow } from "../../src/components/ListRow";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
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

type PillTone = "default" | "warning" | "danger" | "success";
type SwipeableControl = {
  close: () => void;
};

const filters: Array<{
  key: InventoryViewFilter;
  label: string;
  icon: LucideIcon;
  tone?: PillTone;
}> = [
  { key: "all", label: "전체", icon: Archive },
  { key: "expiring", label: "임박", icon: Clock3, tone: "warning" },
  { key: "expired", label: "만료", icon: CircleAlert, tone: "danger" },
];

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

  const items = data ?? [];
  const hasLoadedInventory = data !== undefined;
  const loadErrorMessage =
    error instanceof Error
      ? error.message
      : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

  const activeItems = useMemo(
    () => items.filter((item) => item.status === ItemStatus.ACTIVE),
    [items],
  );

  const filtered = useMemo(
    () => filterInventoryItems(activeItems, filter, location),
    [activeItems, filter, location],
  );
  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const filterCounts = useMemo(
    () => ({
      all: activeItems.length,
      expiring: filterInventoryItems(activeItems, "expiring", "all").length,
      expired: filterInventoryItems(activeItems, "expired", "all").length,
    }),
    [activeItems],
  );
  const locationCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.values(StorageLocation).map((value) => [value, 0]),
    ) as Record<StorageLocation, number>;

    activeItems.forEach((item) => {
      counts[item.storageLocation] += 1;
    });

    return counts;
  }, [activeItems]);

  const activeFilterLabel =
    filters.find((item) => item.key === filter)?.label ?? "전체";
  const activeLocationLabel =
    location === "all" ? "모든 위치" : storageLocationLabels[location];
  const hasActiveFilters = filter !== "all" || location !== "all";
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

  const handleSwipeDiscard = (
    item: InventoryItem,
    swipeable: SwipeableControl,
  ) => {
    swipeable.close();
    setSuccessMessage(null);
    setActionErrorMessage(null);
    void deferredDiscard.scheduleDiscard(item);
  };

  return (
    <Screen
      scroll={false}
      title="보관함"
      subtitle={
        isLoading && !hasLoadedInventory
          ? "장고가 보관함을 살펴보고 있어요."
          : isError && !hasLoadedInventory
            ? "앗, 보관함을 불러오지 못했어요."
            : isEmptyInventory
              ? "장고랑 같이 재료를 채워볼까요?"
              : `${filtered.length}개를 유통기한이 가까운 순서로 보여드릴게요.`
      }
      headerAction={
        showListChrome ? (
          isSelectionMode ? (
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
                accessibilityLabel="필터 열기"
              >
                <SlidersHorizontal
                  color={colors.primary}
                  size={spacing.sm + spacing.xxs}
                  strokeWidth={2.4}
                />
                <Text style={styles.headerFilterLabel}>필터</Text>
              </Pressable>
            </View>
          )
        ) : null
      }
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
                : filtered
        }
        keyExtractor={(item) => item.id}
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

            {showListChrome && !isSelectionMode ? (
              <Pressable
                onPress={() => setIsFilterSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="어떤 재료를 볼까요?"
                accessibilityHint="상태와 보관 위치로 골라 볼 수 있어요."
                style={({ pressed }) => [
                  styles.filterSummary,
                  pressed && styles.filterSummaryPressed,
                ]}
              >
                <View style={styles.filterSummaryCopy}>
                  <Text style={styles.filterSummaryLabel}>지금 보는 목록</Text>
                  <Text style={styles.filterSummaryValue}>
                    {activeFilterLabel} · {activeLocationLabel}
                    {hasActiveFilters ? "" : " · 가까운 순"}
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
              title="이 조건에는 재료가 없어요"
              description="필터를 조금 넓히거나, 새 재료를 넣어볼까요?"
              actionLabel="필터 다시 고르기"
              onAction={() => setIsFilterSheetOpen(true)}
            />
          ) : null
        }
        renderItem={({ item }) =>
          isSelectionMode ? (
            <InventoryCard
              item={item}
              selected={selectedIdSet.has(item.id)}
              selectionMode
              onPress={() => handleCardPress(item.id)}
              onLongPress={() => handleCardLongPress(item.id)}
            />
          ) : (
            <SwipeableInventoryCard
              item={item}
              isDiscarding={deferredDiscard.isPending}
              onPress={() => handleCardPress(item.id)}
              onLongPress={() => handleCardLongPress(item.id)}
              onMenuPress={() => handleOpenItemMenu(item)}
              onDiscard={handleSwipeDiscard}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      />

      <BottomSheet
        visible={Boolean(menuItem)}
        onClose={() => setMenuItem(null)}
        mascotMood="idle"
        title={menuItem?.displayName ?? "이 재료를 어떻게 할까요?"}
        description="자세히 보거나, 골라서 정리할 수 있어요."
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
        title="어떤 재료를 볼까요?"
        description="상태와 위치를 고르면 목록을 바로 바꿔 드릴게요."
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
          <SectionHeader title="상태" description="임박하거나 만료된 재료만 볼 수 있어요." />
          <View style={styles.pillRow}>
            {filters.map((item) => (
              <Pill
                key={item.key}
                label={item.label}
                icon={item.icon}
                count={filterCounts[item.key]}
                tone={item.tone}
                selected={filter === item.key}
                onPress={() => applyFilter(item.key)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetSection}>
          <SectionHeader title="위치" description="어디에 둔 재료인지 골라 주세요." />
          <View style={styles.pillRow}>
            <Pill
              label="전체 위치"
              icon={MapPin}
              count={activeItems.length}
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

function SwipeableInventoryCard({
  item,
  isDiscarding,
  onPress,
  onLongPress,
  onMenuPress,
  onDiscard,
}: {
  item: InventoryItem;
  isDiscarding: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress: () => void;
  onDiscard: (item: InventoryItem, swipeable: SwipeableControl) => void;
}) {
  return (
    <Swipeable
      friction={2}
      rightThreshold={touchTarget.icon}
      overshootRight={false}
      renderRightActions={(_, __, swipeable) => (
        <Pressable
          disabled={isDiscarding}
          onPress={() => onDiscard(item, swipeable)}
          style={({ pressed }) => [
            styles.swipeAction,
            pressed && styles.swipeActionPressed,
            isDiscarding && styles.swipeActionDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="이 재료 정리하기"
        >
          <Trash2 color={colors.surface} size={spacing.md} strokeWidth={2.4} />
          <Text style={styles.swipeActionLabel}>정리할게요</Text>
        </Pressable>
      )}
    >
      <InventoryCard
        item={item}
        onPress={onPress}
        onLongPress={onLongPress}
        onMenuPress={onMenuPress}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
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
  swipeAction: {
    width: spacing.xxxl + spacing.lg,
    minHeight: touchTarget.min,
    borderRadius: radius.xxl,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  swipeActionPressed: {
    backgroundColor: colors.dangerPressed,
  },
  swipeActionDisabled: {
    opacity: 0.55,
  },
  swipeActionLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.surface,
    textAlign: "center",
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
