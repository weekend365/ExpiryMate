import { groupInventoryItems } from "@expirymate/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  Barcode,
  ChevronRight,
  Clock3,
  PenLine,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
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
import { colors, radius, spacing, touchTarget } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

/** Temporary release notice — remove when feedback channel is no longer needed on home. */
const SHOW_TEMP_RELEASE_NOTICE = true;
const RELEASE_NOTICE_DISMISSED_KEY = "home-release-notice-v1-dismissed";
const TEMP_RELEASE_NOTICE_MESSAGE =
  "새 버전을 다듬고 있어요. 불편한 점을 알려 주세요.";
const difficultyLabels = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
} as const;

export default function HomeScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useDashboardSummary();
  const {
    status: recipeGenerationStatus,
    errorMessage: recipeGenerationError,
    acknowledgeRecipeGeneration,
  } = useRecipeGeneration();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [releaseNoticeVisible, setReleaseNoticeVisible] = useState<
    boolean | null
  >(null);
  const noticeCarouselRef = useRef<ScrollView>(null);

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

  const noticeIds = notices.map((notice) => notice.id).join("|");
  const hasMultipleNotices = notices.length > 1;
  const activeNotice = notices[noticeIndex] ?? notices[0] ?? null;
  const heroTone = getHeroTone(activeNotice);
  const recommendationPreview = data?.latestRecommendationPreview ?? null;

  useEffect(() => {
    setNoticeIndex((current) => {
      if (notices.length === 0) {
        return 0;
      }

      return Math.min(current, notices.length - 1);
    });
    noticeCarouselRef.current?.scrollTo({ x: 0, animated: false });
  }, [noticeIds, notices.length]);

  useEffect(() => {
    if (!SHOW_TEMP_RELEASE_NOTICE) {
      setReleaseNoticeVisible(false);
      return;
    }

    let active = true;

    void AsyncStorage.getItem(RELEASE_NOTICE_DISMISSED_KEY)
      .then((dismissed) => {
        if (active) {
          setReleaseNoticeVisible(!dismissed);
        }
      })
      .catch(() => {
        if (active) {
          setReleaseNoticeVisible(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const openInventoryFilter = (nextFilter: InventoryViewFilter) => {
    router.push({
      pathname: "/(tabs)/inventory",
      params: { filter: nextFilter },
    });
  };

  const handleManualRegister = () => {
    clearPrefill();
    router.push("/register");
  };

  const handleOpenScanner = () => {
    clearPrefill();
    router.push("/scanner");
  };

  const handleOpenRecommendations = () => {
    acknowledgeRecipeGeneration();
    router.push("/(tabs)/recommendations");
  };

  const dismissReleaseNotice = () => {
    setReleaseNoticeVisible(false);
    void AsyncStorage.setItem(RELEASE_NOTICE_DISMISSED_KEY, "true").catch(
      () => undefined,
    );
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

  const handleNoticeScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (carouselWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / carouselWidth,
    );
    setNoticeIndex(
      Math.max(0, Math.min(nextIndex, Math.max(notices.length - 1, 0))),
    );
  };

  return (
    <Screen
      scroll={false}
      contentWidth="wide"
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
          contentContainerStyle={styles.scrollContent}
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
          <SurfaceCard variant="hero" tone={heroTone}>
            {notices.length > 0 ? (
              <View
                style={styles.noticeBlock}
                onLayout={(event) => {
                  const width = event.nativeEvent.layout.width;
                  if (width > 0 && width !== carouselWidth) {
                    setCarouselWidth(width);
                  }
                }}
              >
                {hasMultipleNotices ? (
                  <View
                    style={styles.noticeGuide}
                    accessibilityRole="text"
                    accessibilityLabel={`${notices.length}개 소식 중 ${noticeIndex + 1}번째. 옆으로 밀면 다음 소식을 볼 수 있어요.`}
                  >
                    <View style={styles.noticeDots}>
                      {notices.map((notice, index) => (
                        <View
                          key={notice.id}
                          style={[
                            styles.noticeDot,
                            index === noticeIndex && styles.noticeDotActive,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

                {carouselWidth > 0 && hasMultipleNotices ? (
                  <ScrollView
                    ref={noticeCarouselRef}
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleNoticeScrollEnd}
                    decelerationRate="fast"
                    style={{ width: carouselWidth }}
                  >
                    {notices.map((notice) => (
                      <View
                        key={notice.id}
                        style={[styles.noticePage, { width: carouselWidth }]}
                      >
                        <HomeJangoNotice
                          notice={notice}
                          onPress={
                            notice.action
                              ? () => handleNoticeAction(notice.action!)
                              : undefined
                          }
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : activeNotice ? (
                  <HomeJangoNotice
                    notice={activeNotice}
                    onPress={
                      activeNotice.action
                        ? () => handleNoticeAction(activeNotice.action!)
                        : undefined
                    }
                  />
                ) : null}
              </View>
            ) : null}

          </SurfaceCard>

          <View style={styles.previewCard}>
            <HomeSectionHeader
              title="추천 미리보기"
              actionLabel={recommendationPreview ? "추천 보기" : "추천 받기"}
              accessibilityLabel={
                recommendationPreview ? "추천 요리 보기" : "요리 추천 받기"
              }
              onPress={handleOpenRecommendations}
            />
            {isInitialLoading ? (
              <View
                style={styles.recommendationPreview}
                accessibilityLabel="추천 미리보기를 불러오고 있어요"
              >
                <SkeletonBlock
                  width={spacing.xl}
                  height={spacing.xl}
                  radiusToken="md"
                />
                <View style={styles.recommendationSkeletonCopy}>
                  <SkeletonBlock height={spacing.sm} width="68%" />
                  <SkeletonBlock height={spacing.sm} width="52%" />
                </View>
              </View>
            ) : isInitialError ? (
              <View style={styles.recommendationPreview}>
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
                  <AppText variant="bodySmall" tone="subtext">
                    추천을 불러오지 못했어요. 위에서 다시 시도해 주세요.
                  </AppText>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={handleOpenRecommendations}
                accessibilityRole="button"
                accessibilityLabel={
                  recommendationPreview
                    ? `${recommendationPreview.title}, ${recommendationPreview.servings}인분, ${recommendationPreview.cookingTimeMinutes}분, ${difficultyLabels[recommendationPreview.difficulty]}`
                    : hasInventory
                      ? "아직 받은 추천이 없어요. 추천 받기"
                      : "재료를 넣으면 맞춤 요리를 추천해 드려요. 추천 탭으로 이동"
                }
                style={({ pressed }) => [
                  styles.recommendationPreview,
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
                    variant={recommendationPreview ? "bodyStrong" : "bodySmall"}
                    numberOfLines={2}
                  >
                    {recommendationPreview
                      ? recommendationPreview.title
                      : hasInventory
                        ? "아직 받은 추천이 없어요"
                        : "재료를 넣으면 맞춤 요리를 추천해 드려요"}
                  </AppText>
                  {recommendationPreview ? (
                    <View style={styles.recipeMeta}>
                      <View style={styles.recipeMetaItem}>
                        <Users
                          color={colors.subtext}
                          size={spacing.sm}
                          strokeWidth={2.2}
                        />
                        <AppText variant="caption" tone="subtext">
                          {recommendationPreview.servings}인분
                        </AppText>
                      </View>
                      <View style={styles.recipeMetaItem}>
                        <Clock3
                          color={colors.subtext}
                          size={spacing.sm}
                          strokeWidth={2.2}
                        />
                        <AppText variant="caption" tone="subtext">
                          {recommendationPreview.cookingTimeMinutes}분
                        </AppText>
                      </View>
                      <AppText variant="caption" tone="subtext">
                        {difficultyLabels[recommendationPreview.difficulty]}
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="caption" tone="subtext">
                      {hasInventory
                        ? "보관 중인 재료로 새 요리를 찾아볼까요?"
                        : "먼저 보관함에 재료를 등록해 주세요."}
                    </AppText>
                  )}
                </View>
                <ChevronRight
                  color={colors.subtext}
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
                style={styles.trafficStrip}
                accessibilityLabel="유통기한 현황을 불러오고 있어요"
              >
                {[0, 1, 2].map((index) => (
                  <View key={index} style={styles.trafficLampPressable}>
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
              <View style={styles.trafficStrip}>
                <Pressable
                  style={({ pressed }) => [
                    styles.trafficLampPressable,
                    pressed && styles.trafficLampPressablePressed,
                  ]}
                  onPress={() => openInventoryFilter("expired")}
                  accessibilityRole="button"
                  accessibilityLabel={`만료됨 ${expiredCount}개`}
                  accessibilityHint="유통기한이 지난 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="만료"
                    value={expiredCount}
                    tone="danger"
                    compact
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.trafficLampPressable,
                    pressed && styles.trafficLampPressablePressed,
                  ]}
                  onPress={() => openInventoryFilter("within7")}
                  accessibilityRole="button"
                  accessibilityLabel={`7일 이내 ${within7DaysCount}개`}
                  accessibilityHint="7일 안에 손볼 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="7일 이내"
                    value={within7DaysCount}
                    tone="warning"
                    compact
                  />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.trafficLampPressable,
                    pressed && styles.trafficLampPressablePressed,
                  ]}
                  onPress={() => openInventoryFilter("safe")}
                  accessibilityRole="button"
                  accessibilityLabel={`여유 ${safeCount}개`}
                  accessibilityHint="유통기한이 8일 이상 남은 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="여유"
                    value={safeCount}
                    tone="success"
                    compact
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
            <View style={styles.quickEntryActions}>
              <Button
                icon={Barcode}
                onPress={handleOpenScanner}
                size="small"
                fullWidth
                style={styles.quickEntryAction}
              >
                바코드 스캔
              </Button>
              <Button
                icon={PenLine}
                onPress={handleManualRegister}
                variant="surface"
                size="small"
                fullWidth
                style={styles.quickEntryAction}
              >
                직접 입력
              </Button>
            </View>
          </View>

          {releaseNoticeVisible ? (
            <View style={styles.announcementSection}>
              <AppText
                variant="bodySmall"
                tone="subtext"
                accessibilityRole="header"
                style={styles.sectionTitle}
              >
                공지사항
              </AppText>
              <View style={styles.releaseNoticeBanner}>
                <Pressable
                  onPress={() => router.push("/settings/support")}
                  accessibilityRole="button"
                  accessibilityLabel={TEMP_RELEASE_NOTICE_MESSAGE}
                  accessibilityHint="설정의 장고에게 물어보기로 이동해요."
                  style={({ pressed }) => [
                    styles.releaseNoticeLink,
                    pressed && styles.releaseNoticeLinkPressed,
                  ]}
                >
                  <AppText
                    variant="bodySmall"
                    tone="primary"
                    numberOfLines={1}
                  >
                    {TEMP_RELEASE_NOTICE_MESSAGE}
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={dismissReleaseNotice}
                  accessibilityRole="button"
                  accessibilityLabel="새 버전 안내 닫기"
                  hitSlop={spacing.xs}
                  style={({ pressed }) => [
                    styles.releaseNoticeClose,
                    pressed && styles.releaseNoticeClosePressed,
                  ]}
                >
                  <X
                    color={colors.subtext}
                    size={spacing.sm + spacing.xxs}
                    strokeWidth={2.4}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
}

function HomeSectionHeader({
  title,
  actionLabel,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  actionLabel: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText
        variant="bodySmall"
        tone="subtext"
        accessibilityRole="header"
        style={styles.sectionTitle}
      >
        {title}
      </AppText>
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
        <AppText variant="caption" tone="primary">
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
    </View>
  );
}

function HomeJangoNotice({
  notice,
  onPress,
}: {
  notice: HomeNotice;
  onPress?: () => void;
}) {
  if (!onPress) {
    return (
      <MascotSpeechBubble
        message={notice.message}
        mood={notice.mood}
        size="small"
      />
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={notice.message}
      accessibilityHint={notice.actionHint}
      style={({ pressed }) => [pressed && styles.noticePressed]}
    >
      <MascotSpeechBubble
        message={notice.message}
        mood={notice.mood}
        size="small"
      />
    </Pressable>
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + spacing.sm,
  },
  noticeBlock: {
    gap: spacing.xs,
  },
  noticeGuide: {
    alignItems: "center",
    justifyContent: "center",
  },
  noticeDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  noticeDot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  noticeDotActive: {
    backgroundColor: colors.primary,
    width: spacing.sm,
  },
  noticePage: {
    justifyContent: "center",
  },
  noticePressed: {
    opacity: 0.88,
  },
  previewCard: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  recommendationPreview: {
    minHeight: spacing.xxxl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
  previewBodyPressed: {
    backgroundColor: colors.surfacePressed,
  },
  recommendationIcon: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
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
  recipeMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  recipeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  quickEntryActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  quickEntryAction: {
    flex: 1,
  },
  announcementSection: {
    gap: spacing.xs,
  },
  releaseNoticeBanner: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  releaseNoticeLink: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
  },
  releaseNoticeLinkPressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  releaseNoticeClose: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  releaseNoticeClosePressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  trafficGroup: {
    gap: spacing.xs,
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
  sectionTitle: {
    fontWeight: "700",
  },
  sectionHeaderAction: {
    minHeight: touchTarget.icon,
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
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mutedSurface,
  },
  trafficLampPressable: {
    flex: 1,
    alignItems: "center",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingVertical: spacing.xxs,
    borderRadius: radius.md,
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
