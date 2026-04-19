import { router } from "expo-router";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import { Button } from "../../src/components/Button";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Screen } from "../../src/components/Screen";
import { StatCard } from "../../src/components/StatCard";
import { colors, spacing } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function HomeScreen() {
  const { data, isLoading, refetch, isRefetching } = useDashboardSummary();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);

  return (
    <Screen
      title="홈"
      subtitle="오늘 만료될 상품과 최근 등록 내역을 한 번에 확인해요."
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      }
    >
      <View style={styles.statsRow}>
        <StatCard label="오늘 만료" value={data?.todayExpiryCount ?? 0} tone="danger" />
        <StatCard label="3일 이내 만료" value={data?.within3DaysCount ?? 0} tone="warning" />
      </View>
      <View style={styles.statsRow}>
        <StatCard label="7일 이내 만료" value={data?.within7DaysCount ?? 0} />
        <StatCard label="전체 보관 중" value={data?.totalActiveCount ?? 0} />
      </View>

      <View style={styles.actionGrid}>
        <Button onPress={() => router.push("/scan")} style={styles.actionButton}>
          바코드 스캔
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            clearPrefill();
            router.push("/register");
          }}
          style={styles.actionButton}
        >
          수동 등록
        </Button>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>최근 등록</Text>
        {data?.recentItems?.length ? (
          data.recentItems.map((item) => (
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
          <Text style={styles.emptyText}>
            {isLoading ? "데이터를 불러오는 중이에요." : "아직 등록한 상품이 없어요."}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>곧 만료될 상품</Text>
        {data?.expiringItems?.length ? (
          data.expiringItems.map((item) => (
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
          <Text style={styles.emptyText}>임박한 상품이 없어요.</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  emptyText: {
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
    color: colors.subtext,
    lineHeight: 22,
  },
});
