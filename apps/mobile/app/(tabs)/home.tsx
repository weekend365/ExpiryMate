import { router } from "expo-router";
import {
  CheckCircle2,
  Package,
  Plus,
  Sparkles,
} from "lucide-react-native";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatCard } from "../../src/components/StatCard";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { colors, radius, spacing, typography } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function HomeScreen() {
  const { data, isLoading, refetch, isRefetching } = useDashboardSummary();
  const {
    status: recipeGenerationStatus,
    errorMessage: recipeGenerationError,
  } = useRecipeGeneration();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);

  const expiringItems = data?.expiringItems ?? [];
  const recentItems = data?.recentItems ?? [];
  const todayExpiryCount = data?.todayExpiryCount ?? 0;
  const within3DaysCount = data?.within3DaysCount ?? 0;
  const within7DaysCount = data?.within7DaysCount ?? 0;
  const totalActiveCount = data?.totalActiveCount ?? 0;
  const priorityCount = todayExpiryCount + within3DaysCount;
  const hasInventory = totalActiveCount > 0;
  const needsAttention = priorityCount > 0;

  const focus = getHomeFocus({
    isLoading,
    needsAttention,
    hasInventory,
    priorityCount,
  });

  const handlePrimaryAction = () => {
    if (focus.action === "register") {
      clearPrefill();
      router.push("/register");
      return;
    }

    router.push("/(tabs)/inventory");
  };

  return (
    <Screen
      title="오늘"
      subtitle="지금 손볼 일 하나만 먼저 볼게요."
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      }
    >
      <View
        style={[
          styles.focusCard,
          needsAttention ? styles.focusCardDanger : styles.focusCardSafe,
        ]}
      >
        <View style={styles.focusRow}>
          <View style={styles.focusCopy}>
            <Text
              style={[
                styles.focusEyebrow,
                needsAttention ? styles.focusEyebrowDanger : styles.focusEyebrowSafe,
              ]}
            >
              지금 해야 할 한 가지
            </Text>
            <Text style={styles.focusTitle}>{focus.title}</Text>
            <Text style={styles.focusDescription}>{focus.description}</Text>
          </View>
          <Mascot
            size="small"
            mood={
              needsAttention ? "worry" : hasInventory ? "idle" : "empty"
            }
            style={styles.focusMascot}
          />
        </View>

        <Button
          icon={focus.action === "register" ? Plus : Package}
          onPress={handlePrimaryAction}
          fullWidth
          variant={needsAttention ? "danger" : "primary"}
          disabled={isLoading}
        >
          {focus.ctaLabel}
        </Button>
      </View>

      {recipeGenerationStatus !== "idle" ? (
        <View style={styles.recipeStatusCard}>
          <View
            style={[
              styles.recipeStatusIcon,
              recipeGenerationStatus === "error" && styles.recipeStatusIconDanger,
            ]}
          >
            {recipeGenerationStatus === "success" ? (
              <CheckCircle2 color={colors.success} size={spacing.md} strokeWidth={2.5} />
            ) : (
              <Sparkles
                color={
                  recipeGenerationStatus === "error" ? colors.danger : colors.primary
                }
                size={spacing.md}
                strokeWidth={2.5}
              />
            )}
          </View>
          <View style={styles.recipeStatusCopy}>
            <Text style={styles.recipeStatusTitle}>
              {recipeGenerationStatus === "pending"
                ? "요리 조합을 찾고 있어요"
                : recipeGenerationStatus === "success"
                  ? "추천이 준비됐어요"
                  : "추천을 만들지 못했어요"}
            </Text>
            <Text style={styles.recipeStatusDescription}>
              {recipeGenerationStatus === "pending"
                ? "다른 화면을 봐도 괜찮아요. 끝나면 알려드릴게요."
                : recipeGenerationStatus === "success"
                  ? "추천 탭에서 오늘 만들 요리를 확인해 보세요."
                  : recipeGenerationError ?? "추천 탭에서 다시 해볼 수 있어요."}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <StatCard
          label="오늘 만료"
          value={todayExpiryCount}
          tone={todayExpiryCount > 0 ? "danger" : "default"}
        />
        <StatCard
          label="7일 이내"
          value={within7DaysCount}
          tone={within7DaysCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="보관 중"
          value={totalActiveCount}
          tone={totalActiveCount > 0 ? "success" : "default"}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="먼저 확인할 재료"
          description={
            needsAttention
              ? "유통기한이 가까운 재료부터 보여드릴게요."
              : "급한 재료가 없으면 여유 있게 둘러보세요."
          }
          action={
            <Text style={styles.sectionCount}>{expiringItems.length}개</Text>
          }
        />
        {expiringItems.length ? (
          <View style={styles.list}>
            {expiringItems.map((item) => (
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
          <EmptyState
            mood={
              isLoading ? "idle" : hasInventory ? "idle" : "empty"
            }
            title={
              isLoading
                ? "보관함을 살펴보고 있어요"
                : hasInventory
                  ? "지금은 급한 재료가 없어요"
                  : "아직 넣어둔 재료가 없어요"
            }
            description={
              isLoading
                ? "잠시만 기다려 주세요."
                : hasInventory
                  ? "여유 있는 재료는 보관함에서 천천히 확인할 수 있어요."
                  : "첫 재료를 넣으면 여기서 임박한 재료를 알려드릴게요."
            }
          />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="최근에 넣은 재료"
          description="방금 넣은 재료를 다시 확인할 수 있어요."
          action={
            <Text style={styles.sectionCount}>{recentItems.length}개</Text>
          }
        />
        {recentItems.length ? (
          <View style={styles.list}>
            {recentItems.map((item) => (
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
          <EmptyState
            mood={isLoading ? "idle" : "empty"}
            title={
              isLoading
                ? "최근 기록을 불러오고 있어요"
                : "아직 등록한 재료가 없어요"
            }
            description={
              isLoading
                ? "곧 보여드릴게요."
                : "첫 재료를 넣으면 요리 추천도 준비할 수 있어요."
            }
          />
        )}
      </View>
    </Screen>
  );
}

function getHomeFocus({
  isLoading,
  needsAttention,
  hasInventory,
  priorityCount,
}: {
  isLoading: boolean;
  needsAttention: boolean;
  hasInventory: boolean;
  priorityCount: number;
}) {
  if (isLoading) {
    return {
      title: "보관함을 확인하고 있어요",
      description: "조금만 기다려 주시면 오늘 할 일을 알려드릴게요.",
      ctaLabel: "잠시만요",
      action: "inventory" as const,
    };
  }

  if (needsAttention) {
    return {
      title: `${priorityCount}개를 먼저 살펴볼까요?`,
      description: "유통기한이 가까운 재료부터 확인하고, 요리에 쓰거나 정리해 보세요.",
      ctaLabel: "임박한 재료 보기",
      action: "expiring" as const,
    };
  }

  if (!hasInventory) {
    return {
      title: "냉장고가 비어 있어요",
      description: "첫 재료를 넣으면 유통기한과 요리 추천을 챙겨 드릴게요.",
      ctaLabel: "재료 추가하기",
      action: "register" as const,
    };
  }

  return {
    title: "오늘은 급한 재료가 없어요",
    description: "여유 있을 때 재료를 더 넣거나, 보관함을 천천히 둘러보세요.",
    ctaLabel: "재료 추가하기",
    action: "register" as const,
  };
}

const styles = StyleSheet.create({
  focusCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  focusCardDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  focusCardSafe: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  focusRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  focusCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  focusMascot: {
    flexShrink: 0,
  },
  focusEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
  },
  focusEyebrowDanger: {
    color: colors.danger,
  },
  focusEyebrowSafe: {
    color: colors.primary,
  },
  focusTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  focusDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodySmall.fontWeight,
    color: colors.subtext,
  },
  recipeStatusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  recipeStatusIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeStatusIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  recipeStatusCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  recipeStatusTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  recipeStatusDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.subtext,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionCount: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.mutedText,
  },
  list: {
    gap: spacing.sm,
  },
});
