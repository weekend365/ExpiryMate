import {
  groupInventoryItems,
  toKstDateOnly,
  type DashboardRecommendationPreview,
} from "@expirymate/shared";
import { router } from "expo-router";
import {
  Barcode,
  ChevronRight,
  PenLine,
  ShoppingBasket,
  Sparkles,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import homeWelcomeBg from "../../assets/backgrounds/home-welcome-bg.png";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { SkeletonBlock } from "../../src/components/ContentSkeleton";
import { JangoHeroNoticeCarousel } from "../../src/components/JangoHeroNoticeCarousel";
import { Screen } from "../../src/components/Screen";
import { StatCard } from "../../src/components/StatCard";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import { SurfaceCard } from "../../src/components/SurfaceCard";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import {
  getHomeNotices,
  type HomeNotice,
  type HomeNoticeAction,
} from "../../src/features/home/home-notices";
import type { InventoryViewFilter } from "../../src/features/inventory/filters";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { colors, radius, spacing, touchTarget } from "../../src/shared/theme";
import {
  getContentMaxWidth,
  useResponsiveLayout,
} from "../../src/shared/responsive-layout";
import { useRegistrationStore } from "../../src/store/registration-store";

const difficultyLabels = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
} as const;

export default function HomeScreen() {
  const { shouldStack, isRegular, width } = useResponsiveLayout();
  const contentMaxWidth = getContentMaxWidth("wide", width);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useDashboardSummary();
  const {
    status: recipeGenerationStatus,
    errorMessage: recipeGenerationError,
    acknowledgeRecipeGeneration,
  } = useRecipeGeneration();
  const { activeSpaceId } = useActiveSpace();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const [noticeIndex, setNoticeIndex] = useState(0);

  const hasLoaded = data !== undefined;
  const isInitialLoading = isLoading && !hasLoaded;
  const isInitialError = isError && !hasLoaded;
  const isRefreshError = isError && hasLoaded;
  const loadErrorMessage =
    error instanceof Error
      ? error.message
      : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

  const expiringItems = data?.expiringItems ?? [];
  const expiringGroups = groupInventoryItems(expiringItems);
  const expiredCount = data?.expiredCount ?? 0;
  const within7DaysCount = data?.within7DaysCount ?? 0;
  const totalActiveCount = data?.totalActiveCount ?? 0;
  const safeCount =
    data?.safeCount ??
    Math.max(totalActiveCount - expiredCount - within7DaysCount, 0);
  const hasInventory = hasLoaded && totalActiveCount > 0;

  const notices = useMemo(
    () =>
      getHomeNotices({
        isInitialLoading,
        isInitialError,
        isRefreshError,
        loadErrorMessage,
        recipeStatus: recipeGenerationStatus,
        recipeErrorMessage: recipeGenerationError,
        expiringGroups,
        hasInventory,
        hasLoaded,
      }),
    [
      expiringGroups,
      hasInventory,
      hasLoaded,
      isInitialError,
      isInitialLoading,
      isRefreshError,
      loadErrorMessage,
      recipeGenerationError,
      recipeGenerationStatus,
    ],
  );

  const activeNotice = notices[noticeIndex] ?? notices[0] ?? null;
  const heroTone = getHeroTone(activeNotice);
  const recommendationPreview = data?.latestRecommendationPreview ?? null;
  const recommendationReason = recommendationPreview
    ? formatRecommendationReason(recommendationPreview.reasonIngredients ?? [])
    : null;
  const hasUrgentRecommendationIngredient =
    recommendationPreview?.reasonIngredients?.some(
      (ingredient) =>
        ingredient.daysUntilExpiry != null && ingredient.daysUntilExpiry <= 7,
    ) ?? false;
  const emphasizeEntryActions = hasLoaded && !isInitialError && !hasInventory;

  const openInventoryFilter = (nextFilter: InventoryViewFilter) => {
    router.push({
      pathname: "/(tabs)/inventory",
      params: { filter: nextFilter },
    });
  };

  const handleManualRegister = () => {
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push("/register");
  };

  const handleOpenScanner = () => {
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push("/scanner");
  };

  const handleOpenRecommendations = () => {
    acknowledgeRecipeGeneration();
    router.push("/(tabs)/recommendations");
  };

  const handleOpenShopping = () => {
    router.push("/shopping");
  };

  const handleNoticeAction = (action: HomeNoticeAction) => {
    switch (action) {
      case "retry":
        void refetch();
        return;
      case "recommendations":
        handleOpenRecommendations();
        return;
      case "expiring":
        openInventoryFilter("within7");
        return;
      case "scanner":
        handleOpenScanner();
        return;
      case "register":
        handleManualRegister();
        return;
      default:
        return;
    }
  };

  return (
    <Screen
      scroll={false}
      contentWidth="wide"
      bottomInsetMode="navigator"
      testID="home-screen"
      contentStyle={styles.screenContent}
    >
      <View style={styles.homeScene}>
        <ImageBackground
          source={homeWelcomeBg}
          style={styles.homeSceneBackground}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          importantForAccessibility="no"
        />
        <View
          pointerEvents="none"
          style={styles.homeSceneVeil}
          importantForAccessibility="no-hide-descendants"
        />
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={[
            styles.scrollContent,
            contentMaxWidth != null && {
              maxWidth: contentMaxWidth,
              width: "100%",
              alignSelf: "center",
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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
          <SpaceSwitcher />
          <SurfaceCard variant="hero" tone={heroTone} style={styles.heroCard}>
            <JangoHeroNoticeCarousel
              notices={notices.map((notice) => ({
                id: notice.id,
                message: notice.message,
                mood: notice.mood,
                onPress: notice.action
                  ? () => handleNoticeAction(notice.action!)
                  : undefined,
                accessibilityHint: notice.actionHint,
              }))}
              bubbleStyle={styles.heroNotice}
              onIndexChange={setNoticeIndex}
            />
          </SurfaceCard>

          <View style={styles.previewCard}>
            <HomeSectionHeader
              title="오늘의 요리 추천"
              metaLabel={
                recommendationPreview
                  ? formatRecommendationCreatedAt(
                      recommendationPreview.createdAt,
                    )
                  : undefined
              }
            />
            {isInitialLoading ? (
              <View
                style={[
                  styles.recommendationPreview,
                  shouldStack && styles.recommendationPreviewStacked,
                ]}
                accessibilityLabel="오늘의 요리 추천을 불러오고 있어요"
              >
                <SkeletonBlock
                  width={spacing.xl}
                  height={spacing.xl}
                  radiusToken="md"
                />
                <View style={styles.recommendationSkeletonCopy}>
                  <SkeletonBlock height={spacing.sm} width="72%" />
                  <SkeletonBlock height={spacing.sm} width="48%" />
                </View>
              </View>
            ) : isInitialError ? (
              <View
                style={[
                  styles.recommendationPreview,
                  shouldStack && styles.recommendationPreviewStacked,
                  styles.recommendationError,
                ]}
              >
                <View style={styles.recommendationIcon}>
                  <Sparkles
                    color={colors.primary}
                    size={spacing.md}
                    strokeWidth={2.2}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </View>
                <View style={styles.recommendationCopy}>
                  <AppText variant="bodyStrong">
                    추천을 불러오지 못했어요
                  </AppText>
                  <AppText variant="caption" tone="subtext">
                    잠시 후 다시 불러오거나 추천 탭에서 확인해 주세요.
                  </AppText>
                  <Button
                    onPress={() => {
                      void refetch();
                    }}
                    variant="secondary"
                    size="small"
                    style={styles.recommendationRetry}
                  >
                    다시 불러오기
                  </Button>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={
                  recommendationPreview || hasInventory
                    ? handleOpenRecommendations
                    : handleManualRegister
                }
                accessibilityRole="button"
                accessibilityLabel={
                  recommendationPreview
                    ? `${recommendationPreview.title}, ${recommendationPreview.servings}인분, ${recommendationPreview.cookingTimeMinutes}분, ${difficultyLabels[recommendationPreview.difficulty]}${recommendationReason ? `, ${recommendationReason}` : ""}`
                    : hasInventory
                      ? "보관 중인 재료로 오늘의 요리 추천받기"
                      : "재료를 등록하고 맞춤 요리 추천받기"
                }
                style={({ pressed }) => [
                  styles.recommendationPreview,
                  shouldStack && styles.recommendationPreviewStacked,
                  pressed && styles.previewBodyPressed,
                ]}
              >
                <View style={styles.recommendationIcon}>
                  <Sparkles
                    color={colors.primary}
                    size={spacing.md}
                    strokeWidth={2.2}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </View>
                <View style={styles.recommendationCopy}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {recommendationPreview
                      ? recommendationPreview.title
                      : hasInventory
                        ? "보관 중인 재료로 오늘의 요리를 찾아볼까요?"
                        : "재료를 등록하면 맞춤 요리를 추천해 드려요"}
                  </AppText>
                  {recommendationPreview ? (
                    <AppText variant="caption" tone="subtext" numberOfLines={2}>
                      {recommendationPreview.servings}인분
                      {"  ·  "}
                      {recommendationPreview.cookingTimeMinutes}분{"  ·  "}
                      {difficultyLabels[recommendationPreview.difficulty]}
                    </AppText>
                  ) : (
                    <AppText variant="caption" tone="subtext">
                      {hasInventory
                        ? "유통기한과 보관 재료를 살펴보고 메뉴를 골라드려요."
                        : "첫 재료를 넣으면 장고가 바로 메뉴를 찾아드릴게요."}
                    </AppText>
                  )}
                  {recommendationReason ? (
                    <AppText
                      variant="caption"
                      tone={
                        hasUrgentRecommendationIngredient
                          ? "warning"
                          : "primary"
                      }
                      numberOfLines={2}
                      style={styles.recommendationReasonText}
                    >
                      {recommendationReason}
                    </AppText>
                  ) : null}
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={spacing.sm}
                  strokeWidth={2.4}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </Pressable>
            )}
          </View>

          <View style={styles.trafficGroup}>
            <HomeSectionHeader
              title="유통기한 현황"
              actionLabel="보관함 보기"
              accessibilityLabel="전체 보관함 보기"
              onPress={() => openInventoryFilter("all")}
            />
            {isInitialLoading ? (
              <View
                style={[
                  styles.trafficStrip,
                  isRegular && styles.trafficStripRegular,
                ]}
                accessibilityLabel="유통기한 현황을 불러오고 있어요"
              >
                {[0, 1, 2].map((index) => (
                  <View
                    key={index}
                    style={[
                      styles.trafficLampPressable,
                      isRegular && styles.trafficLampPressableRegular,
                    ]}
                  >
                    <SkeletonBlock
                      width={spacing.xxl}
                      height={spacing.xxl}
                      radiusToken="pill"
                    />
                  </View>
                ))}
              </View>
            ) : isInitialError ? (
              <View style={styles.inventoryEmpty}>
                <AppText variant="bodySmall" tone="subtext">
                  현황을 불러오지 못했어요. 위에서 다시 시도해 주세요.
                </AppText>
              </View>
            ) : hasInventory ? (
              <View
                style={[
                  styles.trafficStrip,
                  isRegular && styles.trafficStripRegular,
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.trafficLampPressable,
                    isRegular && styles.trafficLampPressableRegular,
                    pressed && styles.trafficLampPressablePressed,
                  ]}
                  onPress={() => openInventoryFilter("expired")}
                  accessibilityRole="button"
                  accessibilityLabel={`만료 ${expiredCount}건`}
                  accessibilityHint="유통기한이 지난 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="만료"
                    value={expiredCount}
                    tone="danger"
                    compact={!isRegular}
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.trafficLampPressable,
                    isRegular && styles.trafficLampPressableRegular,
                    pressed && styles.trafficLampPressablePressed,
                  ]}
                  onPress={() => openInventoryFilter("within7")}
                  accessibilityRole="button"
                  accessibilityLabel={`7일 이내 ${within7DaysCount}건`}
                  accessibilityHint="7일 안에 손볼 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="7일 이내"
                    value={within7DaysCount}
                    tone="warning"
                    compact={!isRegular}
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.trafficLampPressable,
                    isRegular && styles.trafficLampPressableRegular,
                    pressed && styles.trafficLampPressablePressed,
                  ]}
                  onPress={() => openInventoryFilter("safe")}
                  accessibilityRole="button"
                  accessibilityLabel={`여유 ${safeCount}건`}
                  accessibilityHint="유통기한이 8일 이상 남은 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="여유"
                    value={safeCount}
                    tone="success"
                    compact={!isRegular}
                    showGlow={false}
                  />
                </Pressable>
              </View>
            ) : (
              <View style={styles.inventoryEmpty}>
                <AppText variant="bodySmall">
                  아직 보관 중인 재료가 없어요
                </AppText>
                <AppText variant="caption" tone="subtext">
                  아래 방법으로 첫 재료를 등록해 보세요.
                </AppText>
              </View>
            )}
            <View style={styles.quickEntrySection}>
              <AppText variant="bodySmall" tone="subtext">
                빠른 동작
              </AppText>
              <View style={styles.quickEntryActions}>
                <Button
                  icon={Barcode}
                  onPress={handleOpenScanner}
                  size={emphasizeEntryActions ? "medium" : "small"}
                  fullWidth
                  testID="home-scan-button"
                >
                  바코드 스캔
                </Button>
                <Button
                  icon={PenLine}
                  onPress={handleManualRegister}
                  variant="surface"
                  size={emphasizeEntryActions ? "medium" : "small"}
                  fullWidth
                  testID="home-manual-register-button"
                >
                  직접 입력
                </Button>
                <Button
                  icon={ShoppingBasket}
                  onPress={handleOpenShopping}
                  variant="surface"
                  size={emphasizeEntryActions ? "medium" : "small"}
                  fullWidth
                  testID="home-shopping-button"
                >
                  장보기
                </Button>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

function HomeSectionHeader({
  title,
  metaLabel,
  actionLabel,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  metaLabel?: string;
  actionLabel?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  return (
    <View
      style={[styles.sectionHeader, shouldStack && styles.sectionHeaderStacked]}
    >
      <AppText variant="bodySmall" tone="subtext" accessibilityRole="header">
        {title}
      </AppText>
      {metaLabel ? (
        <AppText variant="caption" tone="muted">
          {metaLabel}
        </AppText>
      ) : actionLabel && accessibilityLabel && onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.sectionHeaderAction,
            pressed && styles.sectionHeaderActionPressed,
          ]}
        >
          <AppText variant="bodySmall" tone="primary">
            {actionLabel}
          </AppText>
          <ChevronRight
            color={colors.primary}
            size={spacing.sm}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function getHeroTone(
  notice: HomeNotice | null,
): "primary" | "warning" | "danger" {
  if (!notice) {
    return "primary";
  }

  if (notice.mood === "worry") {
    return notice.action === "expiring" ? "warning" : "danger";
  }

  if (notice.id === "expiring") {
    return "warning";
  }

  return "primary";
}

function formatRecommendationReason(
  ingredients: DashboardRecommendationPreview["reasonIngredients"],
) {
  if (ingredients.length === 0) {
    return null;
  }

  const prioritizedIngredients = [...ingredients].sort(
    (left, right) =>
      (left.daysUntilExpiry ?? Number.POSITIVE_INFINITY) -
      (right.daysUntilExpiry ?? Number.POSITIVE_INFINITY),
  );
  const ingredient = prioritizedIngredients[0];

  if (ingredient.daysUntilExpiry == null) {
    return `${ingredient.name} 활용 추천이에요`;
  }

  if (ingredient.daysUntilExpiry < 0) {
    return `${ingredient.name}의 상태를 먼저 확인해 주세요`;
  }

  if (ingredient.daysUntilExpiry === 0) {
    return `${ingredient.name} 유통기한이 오늘까지예요`;
  }

  return `${ingredient.name} 유통기한이 ${ingredient.daysUntilExpiry}일 남았어요`;
}

function formatRecommendationCreatedAt(createdAt: string) {
  try {
    const createdDate = toKstDateOnly(createdAt);
    const today = toKstDateOnly(new Date());

    if (createdDate === today) {
      return "오늘 추천";
    }

    return `${new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      timeZone: "Asia/Seoul",
    }).format(new Date(createdAt))} 추천`;
  } catch {
    return "최근 추천";
  }
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    gap: spacing.none,
    paddingHorizontal: spacing.none,
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  homeScene: {
    flex: 1,
    overflow: "hidden",
  },
  homeSceneBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  homeSceneVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.24,
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + spacing.sm,
  },
  heroCard: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  heroNotice: {
    minHeight: spacing.xxxl + spacing.xs,
  },
  previewCard: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  recommendationPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
  recommendationPreviewStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  previewBodyPressed: {
    backgroundColor: colors.surfacePressed,
  },
  recommendationError: {
    minHeight: 0,
  },
  recommendationIcon: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  recommendationCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  recommendationSkeletonCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  recommendationReasonText: {
    flexShrink: 1,
  },
  recommendationRetry: {
    alignSelf: "flex-start",
  },
  quickEntrySection: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickEntryActions: {
    flexDirection: "column",
    gap: spacing.xs,
  },
  trafficGroup: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  sectionHeader: {
    minHeight: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  sectionHeaderStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  sectionHeaderAction: {
    minHeight: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingLeft: spacing.xs,
    borderRadius: radius.md,
  },
  sectionHeaderActionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  trafficStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
  trafficStripRegular: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  trafficLampPressable: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    minHeight: touchTarget.min,
    justifyContent: "flex-start",
    paddingVertical: spacing.xxs,
    borderRadius: radius.md,
  },
  trafficLampPressableRegular: {
    minHeight: touchTarget.cta,
    paddingVertical: spacing.xs,
  },
  trafficLampPressablePressed: {
    backgroundColor: colors.surfacePressed,
  },
  inventoryEmpty: {
    minHeight: touchTarget.ctaLarge,
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
});
