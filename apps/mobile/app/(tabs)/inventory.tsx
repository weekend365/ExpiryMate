import { StorageLocation, storageLocationLabels } from "@expirymate/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { filterInventoryItems, type InventoryViewFilter } from "../../src/features/inventory/filters";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { colors, spacing } from "../../src/shared/theme";

const filters: Array<{ key: InventoryViewFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "expiring", label: "임박" },
  { key: "expired", label: "만료" },
];

export default function InventoryScreen() {
  const { data = [] } = useInventoryList();
  const [filter, setFilter] = useState<InventoryViewFilter>("all");
  const [location, setLocation] = useState<StorageLocation | "all">("all");

  const filtered = useMemo(
    () => filterInventoryItems(data, filter, location),
    [data, filter, location],
  );

  return (
    <Screen
      title="재고 목록"
      subtitle="임박 상품, 만료 상품, 저장 위치별 재고를 빠르게 확인해요."
    >
      <View style={styles.pillRow}>
        {filters.map((item) => (
          <Pill
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>

      <View style={styles.pillRow}>
        <Pill
          label="전체 위치"
          selected={location === "all"}
          onPress={() => setLocation("all")}
        />
        {Object.values(StorageLocation).map((value) => (
          <Pill
            key={value}
            label={storageLocationLabels[value]}
            selected={location === value}
            onPress={() => setLocation(value)}
          />
        ))}
      </View>

      {filtered.length ? (
        filtered.map((item) => (
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
        ))
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
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 24,
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
    lineHeight: 22,
    color: colors.subtext,
  },
});
