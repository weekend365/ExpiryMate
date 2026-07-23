import { groupInventoryItems } from "@expirymate/shared";
import { router } from "expo-router";
import { Barcode, Package, PenLine } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import {
  HomeListSkeleton,
  HomeStatsSkeleton,
} from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryGroupCard } from "../../src/components/InventoryGroupCard";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatCard } from "../../src/components/StatCard";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { colors, radius, spacing, touchTarget } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

const EXPIRING_PREVIEW_COUNT = 2;
/** Escalate hero to danger when priority items reach this count. */
const DANGER_PRIORITY_THRESHOLD = 3;

export default function HomeScreen() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useDashboardSummary();
  const {
    status: recipeGenerationStatus,
    errorMessage: recipeGenerationError,
  } = useRecipeGeneration();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  const hasLoaded = data !== undefined;
  const isInitialLoading = isLoading && !hasLoaded;
  const isInitialError = isError && !hasLoaded;
  const loadErrorMessage =
    error instanceof Error
      ? error.message
      : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

  const expiringItems = data?.expiringItems ?? [];
  const expiringGroups = groupInventoryItems(expiringItems);
  const expiringPreview = expiringGroups.slice(0, EXPIRING_PREVIEW_COUNT);
  const todayExpiryCount = data?.todayExpiryCount ?? 0;
  const within3DaysCount = data?.within3DaysCount ?? 0;
  const within7DaysCount = data?.within7DaysCount ?? 0;
  const totalActiveCount = data?.totalActiveCount ?? 0;
  // within3DaysCount already includes "today" — do not add todayExpiryCount again.
  const priorityCount = within3DaysCount;
  const hasInventory = hasLoaded && totalActiveCount > 0;
  const needsAttention = hasLoaded && priorityCount > 0;

  const focusTone = getHomeFocusTone({
    isInitialError,
    needsAttention,
    priorityCount,
    todayExpiryCount,
  });

  const focus = getHomeFocus({
    isInitialLoading,
    isInitialError,
    needsAttention,
    hasInventory,
    priorityCount,
  });

  const handlePrimaryAction = () => {
    if (focus.action === "retry") {
      void refetch();
      return;
    }

    if (focus.action === "scanner") {
      clearPrefill();
      router.push("/scanner");
      return;
    }

    if (focus.action === "expiring") {
      router.push({
        pathname: "/(tabs)/inventory",
        params: { filter: "expiring" },
      });
      return;
    }

    router.push("/(tabs)/inventory");
  };

  const handleManualRegister = () => {
    clearPrefill();
    router.push("/register");
  };

  const handleOpenScanner = () => {
    clearPrefill();
    router.push("/scanner");
  };

  const openExpiringInventory = () => {
    router.push({
      pathname: "/(tabs)/inventory",
      params: { filter: "expiring" },
    });
  };

  const setGroupExpanded = (groupId: string, expanded: boolean) => {
    setExpandedGroupIds((current) =>
      expanded
        ? [...new Set([...current, groupId])]
        : current.filter((id) => id !== groupId),
    );
  };

  const showAddEntries = focus.showSecondaryEntry;
  const showBarcodeEntry = showAddEntries && focus.action !== "scanner";
  const showManualEntry = showAddEntries;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
    >
      <SurfaceCard variant="hero" tone={focusTone}>
        <View style={styles.focusRow}>
          <View style={styles.focusCopy}>
            <AppText
              variant="label"
              tone={
                focusTone === "danger"
                  ? "danger"
                  : focusTone === "warning"
                    ? "warning"
                    : "primary"
              }
            >
              지금 해야 할 한 가지
            </AppText>
            <AppText variant="heading">{focus.title}</AppText>
            <AppText variant="bodySmall" tone="subtext">
              {focus.description}
            </AppText>
          </View>
          <Mascot
            size="small"
            mood={
              isInitialError || needsAttention
                ? "worry"
                : isInitialLoading
                  ? "idle"
                  : hasInventory
                    ? "idle"
                    : "empty"
            }
            style={styles.focusMascot}
          />
        </View>

        {focus.ctaLabel ? (
          <View style={styles.ctaBlock}>
            <Button
              icon={
                focus.action === "scanner"
                  ? Barcode
                  : focus.action === "retry"
                    ? undefined
                    : Package
              }
              onPress={handlePrimaryAction}
              fullWidth
              variant={focusTone === "danger" ? "danger" : "primary"}
            >
              {focus.ctaLabel}
            </Button>
            {showBarcodeEntry ? (
              <Button
                icon={Barcode}
                onPress={handleOpenScanner}
                fullWidth
                variant="surface"
              >
                바코드로 넣을래요
              </Button>
            ) : null}
            {showManualEntry ? (
              <Button
                icon={PenLine}
                onPress={handleManualRegister}
                fullWidth
                variant="surface"
              >
                직접 입력할게요
              </Button>
            ) : null}
          </View>
        ) : null}
      </SurfaceCard>

      {isError && hasLoaded ? (
        <FeedbackBanner
          tone="danger"
          title="앗, 최신 내용을 불러오지 못했어요"
          description={loadErrorMessage}
          actionLabel="다시 불러올게요"
          onAction={() => {
            void refetch();
          }}
        />
      ) : null}

      {recipeGenerationStatus !== "idle" ? (
        <FeedbackBanner
          tone={
            recipeGenerationStatus === "error"
              ? "danger"
              : recipeGenerationStatus === "success"
                ? "success"
                : "info"
          }
          title={
            recipeGenerationStatus === "pending"
              ? "요리 조합을 찾고 있어요"
              : recipeGenerationStatus === "success"
                ? "추천이 준비됐어요"
                : "추천을 만들지 못했어요"
          }
          description={
            recipeGenerationStatus === "pending"
              ? "다른 화면을 봐도 괜찮아요. 끝나면 알려드릴게요."
              : recipeGenerationStatus === "success"
                ? "추천 탭에서 오늘 만들 요리를 살펴보세요."
                : recipeGenerationError ?? "추천 탭에서 다시 해볼 수 있어요."
          }
          showMascot={false}
        />
      ) : null}

      {isInitialLoading ? (
        <HomeStatsSkeleton />
      ) : isInitialError ? null : (
        <View
          style={styles.trafficGroup}
          accessibilityRole="summary"
          accessibilityLabel={`오늘 만료 ${todayExpiryCount}개, 7일 이내 ${within7DaysCount}개, 보관 중 ${totalActiveCount}개`}
        >
          <View style={styles.trafficStrip}>
            <StatCard
              variant="traffic"
              label="오늘 만료"
              value={todayExpiryCount}
              tone="danger"
              showLabel={false}
            />
            <StatCard
              variant="traffic"
              label="7일 이내"
              value={within7DaysCount}
              tone="warning"
              showLabel={false}
            />
            <StatCard
              variant="traffic"
              label="보관 중"
              value={totalActiveCount}
              tone="success"
              showLabel={false}
            />
          </View>
          <View style={styles.trafficLabels} importantForAccessibility="no-hide-descendants">
            <AppText variant="caption" tone="subtext" style={styles.trafficLabel}>
              오늘 만료
            </AppText>
            <AppText variant="caption" tone="subtext" style={styles.trafficLabel}>
              7일 이내
            </AppText>
            <AppText variant="caption" tone="subtext" style={styles.trafficLabel}>
              보관 중
            </AppText>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader
          title="먼저 살펴볼 재료"
          description={
            isInitialLoading
              ? "곧 임박한 재료를 보여드릴게요."
              : isInitialError
                ? "다시 불러오면 여기서 확인할 수 있어요."
                : needsAttention
                  ? "유통기한이 가까운 재료부터 보여드릴게요."
                  : "급한 재료가 없으면 여유 있게 둘러보세요."
          }
          action={
            hasLoaded ? (
              <AppText variant="bodyStrong" tone="muted">
                {expiringGroups.length}개 품목
              </AppText>
            ) : null
          }
        />
        {isInitialLoading ? (
          <HomeListSkeleton />
        ) : isInitialError ? (
          <FeedbackBanner
            tone="danger"
            title="앗, 목록을 불러오지 못했어요"
            description={loadErrorMessage}
            actionLabel="다시 불러올게요"
            onAction={() => {
              void refetch();
            }}
          />
        ) : expiringPreview.length ? (
          <View style={styles.list}>
            {expiringPreview.map((group) => (
              <InventoryGroupCard
                key={group.id}
                group={group}
                expanded={expandedGroupIds.includes(group.id)}
                onExpandedChange={(expanded) =>
                  setGroupExpanded(group.id, expanded)
                }
                onItemPress={(item) =>
                  router.push({
                    pathname: "/inventory/[id]",
                    params: { id: item.id },
                  })
                }
              />
            ))}
            {expiringGroups.length > EXPIRING_PREVIEW_COUNT ? (
              <Pressable
                onPress={openExpiringInventory}
                accessibilityRole="button"
                accessibilityLabel="임박한 재료 더 보기"
                style={({ pressed }) => [
                  styles.inventoryLink,
                  pressed && styles.inventoryLinkPressed,
                ]}
              >
                <AppText variant="bodyStrong" tone="primary">
                  보관함에서 더 볼게요
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <EmptyState
            variant="plain"
            showMascot={!hasInventory}
            mood={hasInventory ? "idle" : "empty"}
            title={
              hasInventory
                ? "지금은 급한 재료가 없어요"
                : "아직 넣어둔 재료가 없어요"
            }
            description={
              hasInventory
                ? "여유 있는 재료는 보관함에서 천천히 볼 수 있어요."
                : "첫 재료를 넣으면 여기서 임박한 재료를 알려드릴게요."
            }
          />
        )}
      </View>
    </Screen>
  );
}

function getHomeFocusTone({
  isInitialError,
  needsAttention,
  priorityCount,
  todayExpiryCount,
}: {
  isInitialError: boolean;
  needsAttention: boolean;
  priorityCount: number;
  todayExpiryCount: number;
}): "primary" | "warning" | "danger" {
  if (isInitialError) {
    return "danger";
  }

  if (!needsAttention) {
    return "primary";
  }

  if (
    todayExpiryCount > 0 ||
    priorityCount >= DANGER_PRIORITY_THRESHOLD
  ) {
    return "danger";
  }

  return "warning";
}

function getHomeFocus({
  isInitialLoading,
  isInitialError,
  needsAttention,
  hasInventory,
  priorityCount,
}: {
  isInitialLoading: boolean;
  isInitialError: boolean;
  needsAttention: boolean;
  hasInventory: boolean;
  priorityCount: number;
}) {
  if (isInitialLoading) {
    return {
      title: "보관함을 살펴보고 있어요",
      description: "조금만 기다려 주시면 오늘 할 일을 알려드릴게요.",
      ctaLabel: null as string | null,
      action: "inventory" as const,
      showSecondaryEntry: false,
    };
  }

  if (isInitialError) {
    return {
      title: "앗, 오늘 할 일을 불러오지 못했어요",
      description: "네트워크가 잠시 흔들렸을 수 있어요. 다시 불러와 볼까요?",
      ctaLabel: "다시 불러올게요",
      action: "retry" as const,
      showSecondaryEntry: false,
    };
  }

  if (needsAttention) {
    return {
      title: `${priorityCount}개를 먼저 살펴볼까요?`,
      description: "유통기한이 가까운 재료부터 살펴보고, 요리에 쓰거나 정리해 보세요.",
      ctaLabel: "임박한 재료 보기",
      action: "expiring" as const,
      showSecondaryEntry: true,
    };
  }

  if (!hasInventory) {
    return {
      title: "냉장고가 비어 있어요",
      description: "바코드만 비춰도 첫 재료를 넣을 수 있어요. 장고가 도와드릴게요.",
      ctaLabel: "바코드로 넣을래요",
      action: "scanner" as const,
      showSecondaryEntry: true,
    };
  }

  return {
    title: "오늘은 급한 재료가 없어요",
    description: "여유 있을 때 바코드로 재료를 더 넣어볼까요?",
    ctaLabel: "바코드로 넣을래요",
    action: "scanner" as const,
    showSecondaryEntry: true,
  };
}

const styles = StyleSheet.create({
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
  ctaBlock: {
    gap: spacing.xs,
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
  trafficLabels: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  trafficLabel: {
    flex: 1,
    textAlign: "center",
  },
  section: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  inventoryLink: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  inventoryLinkPressed: {
    backgroundColor: colors.surfacePressed,
  },
});
