import { router } from "expo-router";
import { Plus, Sparkles, Utensils } from "lucide-react-native";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import { Button } from "../../src/components/Button";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Screen } from "../../src/components/Screen";
import { colors, spacing } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function HomeScreen() {
  const { data, isLoading, refetch, isRefetching } = useDashboardSummary();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const expiringItems = data?.expiringItems ?? [];
  const recentItems = data?.recentItems ?? [];
  const priorityCount = (data?.todayExpiryCount ?? 0) + (data?.within3DaysCount ?? 0);
  const heroTitle = isLoading
    ? "보관함을 확인하고 있어요"
    : priorityCount
      ? `${priorityCount}개를 먼저 확인하세요`
      : "오늘 급한 상품이 없어요";
  const heroDescription = priorityCount
    ? "유통기한이 가까운 재료부터 요리에 활용하거나 정리해보세요."
    : "재료를 등록하면 냉장고 상황에 맞춰 요리 추천을 준비할게요.";

  return (
    <Screen
      title="오늘"
      subtitle="먼저 먹거나 정리할 상품부터 보여드려요."
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Sparkles color={colors.primary} size={20} strokeWidth={2.5} />
        </View>
        <Text style={styles.heroEyebrow}>오늘 처리할 항목</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroDescription}>{heroDescription}</Text>
      </View>

      <View style={styles.actionGrid}>
        <Button
          icon={Utensils}
          onPress={() => {
            clearPrefill();
            router.push("/register");
          }}
          style={styles.actionButton}
        >
          요리 재료 추가
        </Button>
        <Button variant="secondary" icon={Plus} onPress={() => router.push("/(tabs)/inventory")} style={styles.actionButton}>
          보관함 보기
        </Button>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>먼저 확인할 재료</Text>
          <Text style={styles.sectionCount}>{expiringItems.length}개</Text>
        </View>
        {expiringItems.length ? (
          expiringItems.map((item) => (
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {isLoading ? "데이터를 불러오는 중이에요" : "임박한 상품이 없어요"}
            </Text>
            <Text style={styles.emptyDescription}>
              여유 있는 재료는 보관함에서 확인할 수 있어요.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{data?.todayExpiryCount ?? 0}</Text>
          <Text style={styles.summaryLabel}>오늘 만료</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{data?.within7DaysCount ?? 0}</Text>
          <Text style={styles.summaryLabel}>7일 이내</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{data?.totalActiveCount ?? 0}</Text>
          <Text style={styles.summaryLabel}>보관 중</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 등록</Text>
          <Text style={styles.sectionCount}>{recentItems.length}개</Text>
        </View>
        {recentItems.length ? (
          recentItems.map((item) => (
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {isLoading ? "데이터를 불러오는 중이에요" : "아직 등록한 재료가 없어요"}
            </Text>
            <Text style={styles.emptyDescription}>
              첫 재료를 추가하면 요리 추천 준비를 시작할 수 있어요.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  heroEyebrow: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  heroTitle: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: "800",
    color: colors.text,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.subtext,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.text,
  },
  sectionCount: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.mutedText,
  },
  summaryStrip: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  summaryValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.subtext,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
});
