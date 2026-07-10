import {
  ItemStatus,
  StorageLocation,
  storageLocationLabels,
  type InventoryItem,
} from "@expirymate/shared";
import { router } from "expo-router";
import {
  Archive,
  CircleAlert,
  Clock3,
  MapPin,
  Plus,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  filterInventoryItems,
  type InventoryViewFilter,
} from "../../src/features/inventory/filters";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import { useDiscardInventoryItem } from "../../src/features/inventory/use-discard-inventory-item";
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
  const { data = [] } = useInventoryList();
  const batchDiscardMutation = useBatchDiscardInventoryItems();
  const discardMutation = useDiscardInventoryItem();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const [filter, setFilter] = useState<InventoryViewFilter>("all");
  const [location, setLocation] = useState<StorageLocation | "all">("all");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeItems = useMemo(
    () => data.filter((item) => item.status === ItemStatus.ACTIVE),
    [data],
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
  const isEmptyInventory = activeItems.length === 0;
  const isFilteredEmpty = !isEmptyInventory && filtered.length === 0;

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

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setIsFilterSheetOpen(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
    setErrorMessage(null);
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
    enterSelectionMode();
    setSelectedIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
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
              setErrorMessage(null);
              const result = await batchDiscardMutation.mutateAsync(selectedIds);
              setSuccessMessage(
                `${result.count}개 재료를 정리했어요. 장고도 한숨 돌렸어요.`,
              );
              setSelectedIds([]);
              setIsSelectionMode(false);
            } catch (error) {
              setErrorMessage(
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

  const handleSwipeDiscard = async (
    item: InventoryItem,
    swipeable: SwipeableControl,
  ) => {
    try {
      setSuccessMessage(null);
      setErrorMessage(null);
      await discardMutation.mutateAsync(item.id);
      swipeable.close();
      setSuccessMessage(`${item.displayName}을(를) 정리했어요.`);
    } catch (error) {
      swipeable.close();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  };

  return (
    <Screen
      title="보관함"
      subtitle={
        isEmptyInventory
          ? "장고랑 같이 재료를 채워볼까요?"
          : `${filtered.length}개를 유통기한이 가까운 순서로 보여드릴게요.`
      }
      headerAction={
        activeItems.length ? (
          isSelectionMode ? (
            <Pressable
              onPress={cancelSelectionMode}
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.headerFilterButton,
                pressed && styles.headerFilterButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="선택 취소"
            >
              <Text style={styles.headerFilterLabel}>그만두기</Text>
            </Pressable>
          ) : (
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
          )
        ) : null
      }
      footer={
        isEmptyInventory || isFilteredEmpty
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
                  : "정리할 재료를 골라주세요"}
              </Button>
            )
            : (
              <Button icon={Plus} onPress={goToRegister} fullWidth>
                재료 넣으러 가기
              </Button>
            )
      }
    >
      {successMessage ? (
        <View style={styles.successStrip}>
          <Mascot size="small" mood="happy" />
          <Text style={styles.successTitle}>{successMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorStrip}>
          <Mascot size="small" mood="worry" />
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>앗, 잠시 문제가 생겼어요</Text>
            <Text style={styles.errorDescription}>{errorMessage}</Text>
          </View>
        </View>
      ) : null}

      {!isEmptyInventory && !isSelectionMode ? (
        <Pressable
          onPress={() => setIsFilterSheetOpen(true)}
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
        <View style={styles.selectionStrip}>
          <Mascot size="small" mood="worry" />
          <View style={styles.selectionCopy}>
            <Text style={styles.selectionTitle}>
              {selectedIds.length
                ? `${selectedIds.length}개 골랐어요`
                : "정리할 재료를 눌러 주세요"}
            </Text>
            <Text style={styles.selectionDescription}>
              길게 눌러 선택을 시작했어요. 아래에서 한 번에 정리할 수 있어요.
            </Text>
          </View>
          <Pressable
            onPress={handleToggleAllVisible}
            disabled={!visibleIds.length}
            style={({ pressed }) => [
              styles.selectionToggle,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <Text style={styles.headerFilterLabel}>
              {allVisibleSelected ? "해제" : "전체"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isEmptyInventory ? (
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
      ) : (
        <View style={styles.list}>
          {filtered.map((item) =>
            isSelectionMode ? (
              <InventoryCard
                key={item.id}
                item={item}
                selected={selectedIdSet.has(item.id)}
                selectionMode
                onPress={() => handleCardPress(item.id)}
                onLongPress={() => handleCardLongPress(item.id)}
              />
            ) : (
              <SwipeableInventoryCard
                key={item.id}
                item={item}
                isDiscarding={
                  discardMutation.isPending &&
                  discardMutation.variables === item.id
                }
                onPress={() => handleCardPress(item.id)}
                onLongPress={() => handleCardLongPress(item.id)}
                onDiscard={handleSwipeDiscard}
              />
            ),
          )}
        </View>
      )}

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
                onPress={enterSelectionMode}
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
                onPress={() => setFilter(item.key)}
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
  onDiscard,
}: {
  item: InventoryItem;
  isDiscarding: boolean;
  onPress: () => void;
  onLongPress: () => void;
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
      <InventoryCard item={item} onPress={onPress} onLongPress={onLongPress} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: typography.bodyStrong.fontWeight,
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
    fontWeight: typography.label.fontWeight,
    color: colors.mutedText,
  },
  filterSummaryValue: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
  filterSummaryAction: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.primary,
  },
  list: {
    gap: spacing.sm,
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
    fontWeight: typography.label.fontWeight,
    color: colors.surface,
    textAlign: "center",
  },
  successStrip: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  successTitle: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  errorStrip: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  errorTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.danger,
  },
  errorDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.text,
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
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  selectionDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
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
