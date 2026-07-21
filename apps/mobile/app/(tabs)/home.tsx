import { router } from "expo-router";
import {
  Barcode,
  CheckCircle2,
  Package,
  Sparkles,
} from "lucide-react-native";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import {
  HomeListSkeleton,
  HomeStatsSkeleton,
} from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryCard } from "../../src/components/InventoryCard";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatCard } from "../../src/components/StatCard";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { colors, radius, spacing, touchTarget, typography } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

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

  const hasLoaded = data !== undefined;
  const isInitialLoading = isLoading && !hasLoaded;
  const isInitialError = isError && !hasLoaded;
  const loadErrorMessage =
    error instanceof Error
      ? error.message
      : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

  const expiringItems = data?.expiringItems ?? [];
  const recentItems = data?.recentItems ?? [];
  const todayExpiryCount = data?.todayExpiryCount ?? 0;
  const within3DaysCount = data?.within3DaysCount ?? 0;
  const within7DaysCount = data?.within7DaysCount ?? 0;
  const totalActiveCount = data?.totalActiveCount ?? 0;
  // within3DaysCount already includes "today" — do not add todayExpiryCount again.
  const priorityCount = within3DaysCount;
  const hasInventory = hasLoaded && totalActiveCount > 0;
  const needsAttention = hasLoaded && priorityCount > 0;

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

  return (
    <Screen
      title="오늘"
      subtitle={
        isInitialError
          ? "앗, 오늘 할 일을 불러오지 못했어요."
          : "지금 손볼 일 하나만 먼저 볼게요."
      }
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
      <View
        style={[
          styles.focusCard,
          isInitialError || needsAttention
            ? styles.focusCardDanger
            : styles.focusCardSafe,
        ]}
      >
        <View style={styles.focusRow}>
          <View style={styles.focusCopy}>
            <Text
              style={[
                styles.focusEyebrow,
                isInitialError || needsAttention
                  ? styles.focusEyebrowDanger
                  : styles.focusEyebrowSafe,
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
            variant={
              isInitialError || needsAttention ? "danger" : "primary"
            }
          >
            {focus.ctaLabel}
          </Button>
        ) : null}

        {focus.showSecondaryEntry ? (
          <Pressable
            onPress={
              focus.action === "scanner" ? handleManualRegister : handleOpenScanner
            }
            style={({ pressed }) => [
              styles.secondaryEntry,
              pressed && styles.secondaryEntryPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              focus.action === "scanner"
                ? "직접 입력할게요"
                : "바코드로 넣을래요"
            }
            accessibilityHint={
              focus.action === "scanner"
                ? "이름과 유통기한을 손으로 적을 수도 있어요."
                : "장고가 바코드를 읽어 넣는 걸 도와줄게요."
            }
          >
            <Text style={styles.secondaryEntryTitle}>
              {focus.action === "scanner"
                ? "직접 입력할게요"
                : "바코드로 넣을래요"}
            </Text>
            <Text style={styles.secondaryEntryDescription}>
              {focus.action === "scanner"
                ? "이름과 유통기한을 손으로 적을 수도 있어요."
                : "장고가 바코드를 읽어 넣는 걸 도와줄게요."}
            </Text>
          </Pressable>
        ) : null}
      </View>

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
                  ? "추천 탭에서 오늘 만들 요리를 살펴보세요."
                  : recipeGenerationError ?? "추천 탭에서 다시 해볼 수 있어요."}
            </Text>
          </View>
        </View>
      ) : null}

      {isInitialLoading ? (
        <HomeStatsSkeleton />
      ) : isInitialError ? null : (
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
              <Text style={styles.sectionCount}>{expiringItems.length}개</Text>
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
        ) : expiringItems.length ? (
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

      <View style={styles.section}>
        <SectionHeader
          title="최근에 넣은 재료"
          description={
            isInitialLoading
              ? "최근 기록을 준비하고 있어요."
              : isInitialError
                ? "다시 불러오면 여기서 확인할 수 있어요."
                : "방금 넣은 재료를 다시 볼 수 있어요."
          }
          action={
            hasLoaded ? (
              <Text style={styles.sectionCount}>{recentItems.length}개</Text>
            ) : null
          }
        />
        {isInitialLoading ? (
          <HomeListSkeleton />
        ) : isInitialError ? null : recentItems.length ? (
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
            mood="empty"
            title="아직 넣어둔 재료가 없어요"
            description="첫 재료를 넣으면 요리 추천도 준비할 수 있어요."
          />
        )}
      </View>
    </Screen>
  );
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
    fontFamily: typography.label.fontFamily,
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
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  focusDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  secondaryEntry: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  secondaryEntryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  secondaryEntryTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  secondaryEntryDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
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
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  recipeStatusDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
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
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.mutedText,
  },
  list: {
    gap: spacing.sm,
  },
});
