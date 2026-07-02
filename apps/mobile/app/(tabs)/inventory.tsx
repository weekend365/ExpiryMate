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
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { filterInventoryItems, type InventoryViewFilter } from "../../src/features/inventory/filters";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import { useDiscardInventoryItem } from "../../src/features/inventory/use-discard-inventory-item";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { Button } from "../../src/components/Button";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { colors, spacing } from "../../src/shared/theme";

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
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const { data = [] } = useInventoryList();
  const batchDiscardMutation = useBatchDiscardInventoryItems();
  const discardMutation = useDiscardInventoryItem();
  const [filter, setFilter] = useState<InventoryViewFilter>("all");
  const [location, setLocation] = useState<StorageLocation | "all">("all");
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

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);

    setSelectedIds((current) => {
      const nextIds = current.filter((id) => visibleIdSet.has(id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [visibleIds]);

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
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
      `${selectedIds.length}개 재료를 폐기할까요?`,
      "폐기한 재료는 보관함 목록에서 사라집니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "폐기",
          style: "destructive",
          onPress: async () => {
            try {
              setErrorMessage(null);
              const result = await batchDiscardMutation.mutateAsync(selectedIds);
              setSuccessMessage(`${result.count}개 재료를 폐기했어요.`);
              setSelectedIds([]);
              setIsSelectionMode(false);
            } catch (error) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "폐기에 실패했어요. 잠시 후 다시 시도해주세요.",
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
      setSuccessMessage(`${item.displayName}을(를) 폐기했어요.`);
    } catch (error) {
      swipeable.close();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "폐기에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  };

  return (
    <Screen
      title="보관함"
      subtitle={`${filtered.length}개 재료를 유통기한이 가까운 순서로 보여드려요.`}
      headerAction={
        activeItems.length ? (
          <Button
            variant="secondary"
            size="small"
            onPress={isSelectionMode ? cancelSelectionMode : enterSelectionMode}
          >
            {isSelectionMode ? "취소" : "선택"}
          </Button>
        ) : null
      }
      footer={
        isSelectionMode ? (
          <Button
            variant="danger"
            icon={Trash2}
            onPress={handleConfirmBatchDiscard}
            loading={batchDiscardMutation.isPending}
            disabled={!selectedIds.length}
            fullWidth
          >
            {selectedIds.length}개 폐기
          </Button>
        ) : null
      }
    >
      {successMessage ? (
        <View style={styles.successStrip}>
          <Text style={styles.successTitle}>{successMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorStrip}>
          <Text style={styles.errorTitle}>폐기에 실패했어요</Text>
          <Text style={styles.errorDescription}>{errorMessage}</Text>
        </View>
      ) : null}

      {isSelectionMode ? (
        <View style={[styles.selectionPanel, isCompact && styles.selectionPanelCompact]}>
          <View style={styles.selectionCopy}>
            <Text style={styles.selectionTitle}>
              {selectedIds.length}개 선택됨
            </Text>
            <Text style={styles.selectionDescription}>
              보이는 재료만 선택해 한 번에 폐기할 수 있어요.
            </Text>
          </View>
          <Button
            variant="secondary"
            size="small"
            onPress={handleToggleAllVisible}
            disabled={!visibleIds.length}
            fullWidth={isCompact}
            style={isCompact ? styles.selectionButtonCompact : undefined}
          >
            {allVisibleSelected ? "전체 해제" : "전체 선택"}
          </Button>
        </View>
      ) : null}

      <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>상태</Text>
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

      <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>위치</Text>
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

      {filtered.length ? (
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
                  discardMutation.isPending && discardMutation.variables === item.id
                }
                onPress={() => handleCardPress(item.id)}
                onLongPress={() => handleCardLongPress(item.id)}
                onDiscard={handleSwipeDiscard}
              />
            ),
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>정리할 재료가 없어요</Text>
          <Text style={styles.emptyDescription}>
            다른 필터를 선택하거나 새 재료를 등록해보세요.
          </Text>
        </View>
      )}
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
      rightThreshold={44}
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
        >
          <Trash2 color={colors.surface} size={24} strokeWidth={2.7} />
        </Pressable>
      )}
    >
      <InventoryCard
        item={item}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  filterPanel: {
    gap: spacing.sm,
  },
  filterTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.subtext,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  swipeAction: {
    width: 76,
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  swipeActionPressed: {
    backgroundColor: "#D92D3A",
  },
  swipeActionDisabled: {
    opacity: 0.55,
  },
  successStrip: {
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.md,
  },
  successTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.text,
  },
  errorStrip: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 16,
    padding: spacing.md,
    gap: 3,
  },
  errorTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.danger,
  },
  errorDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  selectionPanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  selectionPanelCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  selectionButtonCompact: {
    alignSelf: "stretch",
  },
  selectionCopy: {
    flex: 1,
    gap: 2,
  },
  selectionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.text,
  },
  selectionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtext,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
});
