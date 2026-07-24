import { groupInventoryItems } from "@expirymate/shared";
import { router } from "expo-router";
import { Barcode, PenLine } from "lucide-react-native";
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
import { HomeStatsSkeleton } from "../../src/components/ContentSkeleton";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { Screen } from "../../src/components/Screen";
import { StatCard } from "../../src/components/StatCard";
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
const TEMP_RELEASE_NOTICE_MESSAGE =
  "안녕하세요! 지금은 새 버전을 다듬는 중이에요. 건의사항이나 불편한 점이 있으면 여기를 눌러 장고에게 알려 주세요. 빠르게 수정 할게요.";

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
  const todayExpiryCount = data?.todayExpiryCount ?? 0;
  const within7DaysCount = data?.within7DaysCount ?? 0;
  const totalActiveCount = data?.totalActiveCount ?? 0;
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
  const showEntryActions = hasLoaded && !isInitialError && !isInitialLoading;
  const heroTone = getHeroTone(activeNotice);

  useEffect(() => {
    setNoticeIndex((current) => {
      if (notices.length === 0) {
        return 0;
      }

      return Math.min(current, notices.length - 1);
    });
    noticeCarouselRef.current?.scrollTo({ x: 0, animated: false });
  }, [noticeIds, notices.length]);

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

  const handleNoticeAction = (action: HomeNoticeAction) => {
    switch (action) {
      case "retry":
        void refetch();
        return;
      case "recommendations":
        acknowledgeRecipeGeneration();
        router.push("/(tabs)/recommendations");
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
    <Screen scroll={false} contentStyle={styles.screenContent}>
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

            {showEntryActions ? (
              <View style={styles.ctaBlock}>
                <Button
                  icon={Barcode}
                  onPress={handleOpenScanner}
                  fullWidth
                  variant="primary"
                >
                  바코드로 넣을래요
                </Button>
                <Button
                  icon={PenLine}
                  onPress={handleManualRegister}
                  fullWidth
                  variant="surface"
                >
                  직접 입력할게요
                </Button>
              </View>
            ) : null}
          </SurfaceCard>

          {isInitialLoading ? (
            <HomeStatsSkeleton />
          ) : isInitialError ? null : (
            <View style={styles.trafficGroup}>
              <View
                style={styles.trafficGuide}
                accessibilityRole="header"
                accessibilityLabel="유통기한 신호등. 빨간불은 오늘 만료, 노란불은 7일 안, 초록불은 보관 중인 재료예요. 불을 누르면 그 재료만 보관함에서 보여 드릴게요."
              >
                <AppText variant="subheading">유통기한 신호등</AppText>
                <AppText variant="bodySmall" tone="subtext">
                  빨간불은 오늘까지, 노란불은 7일 안, 초록불은 유통기한이
                  여유로운 상태를 나타내요. 램프를 누르면 보관함에서 그 재료만
                  보여 드릴게요.
                </AppText>
              </View>
              <View
                style={styles.trafficStrip}
                accessibilityRole="summary"
                accessibilityLabel={`오늘 만료 ${todayExpiryCount}개, 7일 이내 ${within7DaysCount}개, 보관 중 ${totalActiveCount}개`}
              >
                <Pressable
                  style={styles.trafficLampPressable}
                  onPress={() => openInventoryFilter("today")}
                  accessibilityRole="button"
                  accessibilityLabel={`오늘 만료 ${todayExpiryCount}개`}
                  accessibilityHint="오늘 만료되는 재료만 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="오늘 만료"
                    value={todayExpiryCount}
                    tone="danger"
                    showLabel={false}
                  />
                </Pressable>
                <Pressable
                  style={styles.trafficLampPressable}
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
                    showLabel={false}
                  />
                </Pressable>
                <Pressable
                  style={styles.trafficLampPressable}
                  onPress={() => openInventoryFilter("all")}
                  accessibilityRole="button"
                  accessibilityLabel={`보관 중 ${totalActiveCount}개`}
                  accessibilityHint="전체 보관 재료를 보관함에서 보여 드릴게요."
                >
                  <StatCard
                    variant="traffic"
                    label="보관 중"
                    value={totalActiveCount}
                    tone="success"
                    showLabel={false}
                  />
                </Pressable>
              </View>
              <View
                style={styles.trafficLabels}
                importantForAccessibility="no-hide-descendants"
              >
                <AppText
                  variant="caption"
                  tone="subtext"
                  style={styles.trafficLabel}
                >
                  오늘 만료
                </AppText>
                <AppText
                  variant="caption"
                  tone="subtext"
                  style={styles.trafficLabel}
                >
                  7일 이내
                </AppText>
                <AppText
                  variant="caption"
                  tone="subtext"
                  style={styles.trafficLabel}
                >
                  보관 중
                </AppText>
              </View>
            </View>
          )}

          {SHOW_TEMP_RELEASE_NOTICE ? (
            <Pressable
              onPress={() => router.push("/settings/support")}
              accessibilityRole="button"
              accessibilityLabel={TEMP_RELEASE_NOTICE_MESSAGE}
              accessibilityHint="설정의 장고에게 물어보기로 이동해요."
              style={({ pressed }) => [
                styles.releaseNoticeCard,
                pressed && styles.releaseNoticeCardPressed,
              ]}
            >
              <MascotSpeechBubble
                message={TEMP_RELEASE_NOTICE_MESSAGE}
                mood="idle"
                size="small"
              />
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
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
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
  ctaBlock: {
    gap: spacing.xs,
  },
  releaseNoticeCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
  },
  releaseNoticeCardPressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  trafficGroup: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  trafficGuide: {
    gap: spacing.xs,
  },
  trafficStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  trafficLampPressable: {
    flex: 1,
    alignItems: "center",
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  trafficLabels: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  trafficLabel: {
    flex: 1,
    textAlign: "center",
  },
});
