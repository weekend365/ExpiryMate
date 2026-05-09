import { StorageLocation, storageLocationLabels } from "@expirymate/shared";
import { router } from "expo-router";
import {
  Archive,
  CircleAlert,
  Clock3,
  MapPin,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { filterInventoryItems, type InventoryViewFilter } from "../../src/features/inventory/filters";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { colors, spacing } from "../../src/shared/theme";

type PillTone = "default" | "warning" | "danger" | "success";

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
  const [filter, setFilter] = useState<InventoryViewFilter>("all");
  const [location, setLocation] = useState<StorageLocation | "all">("all");

  const filtered = useMemo(
    () => filterInventoryItems(data, filter, location),
    [data, filter, location],
  );
  const filterCounts = useMemo(
    () => ({
      all: data.length,
      expiring: filterInventoryItems(data, "expiring", "all").length,
      expired: filterInventoryItems(data, "expired", "all").length,
    }),
    [data],
  );
  const locationCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.values(StorageLocation).map((value) => [value, 0]),
    ) as Record<StorageLocation, number>;

    data.forEach((item) => {
      counts[item.storageLocation] += 1;
    });

    return counts;
  }, [data]);

  return (
    <Screen
      title="보관함"
      subtitle={`${filtered.length}개 상품을 유통기한이 가까운 순서로 보여드려요.`}
    >
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
            count={data.length}
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
          {filtered.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/inventory/[id]",
                  params: { id: item.id },
                })
              }
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>조건에 맞는 재고가 없어요</Text>
          <Text style={styles.emptyDescription}>
            다른 필터를 선택하거나 새 상품을 등록해보세요.
          </Text>
        </View>
      )}
    </Screen>
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
