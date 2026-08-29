import {
  groupInventoryItems,
  toKstDateOnly,
  type DashboardRecommendationPreview,
} from "@expirymate/shared";
import { router } from "expo-router";
import { ChevronRight, Sparkles, TrendingDown } from "lucide-react-native";
import { useMemo } from "react";
import {
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import homeWelcomeBg from "../../assets/backgrounds/home-welcome-bg.png";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { SkeletonBlock } from "../../src/components/ContentSkeleton";
import { Screen } from "../../src/components/Screen";
import { StatCard } from "../../src/components/StatCard";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import { useDashboardSummary } from "../../src/features/dashboard/use-dashboard-summary";
import { HomeHero } from "../../src/features/home/home-hero";
import {
  getHomeNotices,
  type HomeNoticeAction,
} from "../../src/features/home/home-notices";
import {
  HomeQuickEntry,
  HomeShoppingCard,
} from "../../src/features/home/home-quick-entry";
import { homeScreenStyles as styles } from "../../src/features/home/home-screen-styles";
import { HomeSectionHeader } from "../../src/features/home/home-section-header";
import { useInsightsPreview } from "../../src/features/insights/use-insights";
import type { InventoryViewFilter } from "../../src/features/inventory/filters";
import {
  photoParseRoute,
  registerRoute,
  scannerRoute,
} from "../../src/features/registration/registration-return";
import { isInventoryPhotoParseEnabled } from "../../src/features/photo-intake/photo-parse-enabled";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { colors, spacing } from "../../src/shared/theme";
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
  const insightsPreview = useInsightsPreview();
  const subscription = useSubscriptionEntitlement();
  const hasPlus = Boolean(
    subscription.query.data?.hasActiveEntitlement &&
      subscription.query.data.planCode === "jango_plus",
  );
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);

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

  const recommendationPreview = data?.latestRecommendationPreview ?? null;
  const recommendationReason = recommendationPreview
    ? formatRecommendationReason(recommendationPreview.reasonIngredients ?? [])
    : null;
  const hasUrgentRecommendationIngredient =
    recommendationPreview?.reasonIngredients?.some(
      (ingredient) =>
        ingredient.daysUntilExpiry != null && ingredient.daysUntilExpiry <= 7,
    ) ?? false;
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
    router.push(registerRoute("home"));
  };

  const handleOpenScanner = () => {
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push(scannerRoute("home"));
  };

  const handleOpenRecommendations = () => {
    acknowledgeRecipeGeneration();
    router.push("/(tabs)/recommendations");
  };

  const handleOpenShopping = () => {
    router.push("/shopping");
  };

  const handleOpenPhotoParse = () => {
    if (activeSpaceId) {
      clearPrefill(activeSpaceId);
    }
    router.push(photoParseRoute("home"));
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
      footer={
        <HomeQuickEntry
          onOpenScanner={handleOpenScanner}
          onManualRegister={handleManualRegister}
          onOpenPhotoParse={
            isInventoryPhotoParseEnabled() ? handleOpenPhotoParse : undefined
          }
        />
      }
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
                void Promise.all([refetch(), insightsPreview.refetch()]);
              }}
            />
          }
        >
          <SpaceSwitcher />
          <HomeHero notices={notices} onNoticeAction={handleNoticeAction} />

          {insightsPreview.data?.ready ? (
            <Pressable
              onPress={() => router.push("/insights")}
              accessibilityRole="button"
              accessibilityLabel={`이번 주 장고 브리핑, 최근 30일 소비 ${insightsPreview.data.consumed}개, 폐기 ${insightsPreview.data.discarded}개`}
              style={({ pressed }) => [
                styles.briefingCard,
                pressed && styles.previewBodyPressed,
              ]}
            >
              <View style={styles.briefingIcon}>
                <TrendingDown
                  color={colors.primary}
                  size={spacing.md}
                  strokeWidth={2.2}
                />
              </View>
              <View style={styles.briefingCopy}>
                <AppText variant="bodyStrong">이번 주 장고 브리핑</AppText>
                <AppText variant="caption" tone="subtext">
                  최근 30일 소비 {insightsPreview.data.consumed}개 · 폐기 {insightsPreview.data.discarded}개
                </AppText>
                <AppText variant="caption" tone="primary">
                  {hasPlus
                    ? "이번 주 실천 제안과 90일 추세를 확인해 보세요."
                    : "기록이 준비됐어요. 무료 미리보기를 확인해 보세요."}
                </AppText>
              </View>
              <ChevronRight
                color={colors.primary}
                size={spacing.sm}
                strokeWidth={2.4}
              />
            </Pressable>
          ) : null}

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
                    다시 불러올게요
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
                  <AppText
                    variant="bodyStrong"
                    numberOfLines={shouldStack ? undefined : 2}
                  >
                    {recommendationPreview
                      ? recommendationPreview.title
                      : hasInventory
                        ? "보관 중인 재료로 오늘의 요리를 찾아볼까요?"
                        : "재료를 등록하면 맞춤 요리를 추천해 드려요"}
                  </AppText>
                  {recommendationPreview ? (
                    <AppText
                      variant="caption"
                      tone="subtext"
                      numberOfLines={shouldStack ? undefined : 2}
                    >
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
                      numberOfLines={shouldStack ? undefined : 2}
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
          </View>

          <HomeShoppingCard onOpenShopping={handleOpenShopping} />
        </ScrollView>
      </View>
    </Screen>
  );
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
