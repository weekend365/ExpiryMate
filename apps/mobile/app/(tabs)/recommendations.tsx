import {
  isTrackedItem,
  summarizeRecipePreference,
  type RecommendationAccess,
  type RecipeInventorySnapshotItem,
  type RecipeMealType,
  type RecipeRecommendation,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import { router } from "expo-router";
import {
  Archive,
  Barcode,
  ChevronDown,
  ChevronUp,
  Clock3,
  Coffee,
  Cookie,
  Heart,
  Moon,
  PenLine,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Timer,
  Utensils,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Alert,
  ImageBackground,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import kitchenCookingBg from "../../assets/backgrounds/kitchen-cooking-bg.png";
import { AppText } from "../../src/components/AppText";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { JangoHeroNoticeCarousel } from "../../src/components/JangoHeroNoticeCarousel";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import { resolveMonetizationOffer } from "../../src/features/monetization/monetization-offer";
import {
  canContinueWithRewardedAd,
  needsRewardedAdToRecommend,
  recommendationQuotaCopy,
} from "../../src/features/monetization/recommendation-access";
import { getRecommendationHeroStatus } from "../../src/features/recipes/recommendation-hero";
import { getRecommendationErrorMessage } from "../../src/features/recipes/recommendation-errors";
import {
  RecommendationOfferAlternativesSheet,
  RecommendationQuotaCard,
  RecommendationValueOfferCard,
} from "../../src/features/recipes/recommendation-quota-panel";
import {
  EXPIRING_DAYS_THRESHOLD,
  formatDishMeta,
  formatIngredientPreview,
  getHighlightedIngredients,
  type RecipeDetailSelection,
} from "../../src/features/recipes/recipe-detail";
import { RecipeDetailSheet } from "../../src/features/recipes/recipe-detail-sheet";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { useRecommendationGenerateFlow } from "../../src/features/recipes/use-recommendation-generate-flow";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { useRecipePreferences } from "../../src/features/settings/use-recipe-preferences";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { useRegistrationStore } from "../../src/store/registration-store";
import {
  getRecipeFavoriteKey,
  useRecipeFavorites,
  useRecipeEngagement,
  useRecipeRecommendations,
  useSetRecipeFavorite,
} from "../../src/features/recipes/use-recipe-recommendations";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { trackMonetizationEvent } from "../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";
import {
  getContentMaxWidth,
  useResponsiveLayout,
} from "../../src/shared/responsive-layout";

const servingOptions = [1, 2, 3, 4];
const timeOptions = [15, 30, 60];
const PREVIOUS_RECOMMENDATION_LIMIT = 5;
const SHEET_TRANSITION_DELAY_MS = 320;
type RecipeView = "recommendations" | "favorites";
type RecipeSectionKey = "latest" | "previous" | "favorites";

const mealTypeOptions: Array<{
  value: RecipeMealType;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "any", label: "상관없음", icon: Utensils },
  { value: "breakfast", label: "아침", icon: Coffee },
  { value: "lunch", label: "점심", icon: Sun },
  { value: "dinner", label: "저녁", icon: Moon },
  { value: "snack", label: "간식", icon: Cookie },
];

export default function RecommendationsScreen() {
  const { shouldStack, width } = useResponsiveLayout();
  const contentMaxWidth = getContentMaxWidth("wide", width);
  const historyQuery = useRecipeRecommendations();
  const favoritesQuery = useRecipeFavorites();
  const inventoryQuery = useInventoryList();
  const setFavoriteMutation = useSetRecipeFavorite();
  const engagementMutation = useRecipeEngagement();
  const {
    status: generationStatus,
    latestGeneratedRecommendation,
    latestGeneratedRecommendationId,
    errorMessage: generationErrorMessage,
    errorCode: generationErrorCode,
  } = useRecipeGeneration();
  const subscription = useSubscriptionEntitlement();
  const monetization = useMonetization();
  const { query: recipePreferencesQuery } = useRecipePreferences();
  const [servings, setServings] = useState(2);
  const [maxCookingMinutes, setMaxCookingMinutes] = useState(30);
  const [mealType, setMealType] = useState<RecipeMealType>("any");
  const [useExpiringFirst, setUseExpiringFirst] = useState(true);
  const [recipeView, setRecipeView] = useState<RecipeView>("recommendations");
  const [collapsedSections, setCollapsedSections] = useState<
    Partial<Record<RecipeSectionKey, boolean>>
  >({});
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [showOfferAlternatives, setShowOfferAlternatives] = useState(false);
  const [entryMethodVisible, setEntryMethodVisible] = useState(false);
  const [historyRecommendation, setHistoryRecommendation] =
    useState<RecipeRecommendation | null>(null);
  const [recipeDetail, setRecipeDetail] =
    useState<RecipeDetailSelection | null>(null);
  const trackedQuotaEventRef = useRef<string | null>(null);
  const trackedScreenDayRef = useRef<string | null>(null);
  const trackedOfferRef = useRef<string | null>(null);
  const { activeSpaceId } = useActiveSpace();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const hasRecommendableInventory = useMemo(
    () => (inventoryQuery.data ?? []).some(isTrackedItem),
    [inventoryQuery.data],
  );
  const inventoryReady =
    inventoryQuery.isSuccess || Boolean(inventoryQuery.isError);
  const needsIngredients = inventoryReady && !hasRecommendableInventory;
  const isGenerating = generationStatus === "pending";
  const buildRecommendationPayload = useCallback(
    () => ({
      servings,
      maxCookingMinutes,
      mealType,
      useExpiringFirst,
    }),
    [maxCookingMinutes, mealType, servings, useExpiringFirst],
  );
  const {
    showAiNotice,
    closeAiNotice,
    handleCreateRecommendation,
    handleAcceptAiNotice,
    handleWatchRewardedAdOnly,
    isAcceptingAiNotice,
  } = useRecommendationGenerateFlow({
    inventoryReady,
    needsIngredients,
    isGenerating,
    buildPayload: buildRecommendationPayload,
    onNeedsIngredients: () => setEntryMethodVisible(true),
  });

  const latestRecommendation = useMemo(
    () => latestGeneratedRecommendation ?? historyQuery.data?.[0] ?? null,
    [historyQuery.data, latestGeneratedRecommendation],
  );
  const previousRecommendations = useMemo(() => {
    const history = historyQuery.data ?? [];
    const latestId = latestRecommendation?.id;

    return history
      .filter((item) => item.id !== latestId)
      .slice(0, PREVIOUS_RECOMMENDATION_LIMIT);
  }, [historyQuery.data, latestRecommendation?.id]);
  const favoriteKeys = useMemo(
    () =>
      new Set(
        (favoritesQuery.data ?? []).map((favorite) =>
          getRecipeFavoriteKey(
            favorite.sourceRecommendationId,
            favorite.sourceDishIndex,
          ),
        ),
      ),
    [favoritesQuery.data],
  );
  const historyErrorMessage = getRecommendationErrorMessage(historyQuery.error);
  const errorMessage = generationErrorMessage ?? historyErrorMessage;
  const isQuotaError = generationErrorCode === "RECOMMENDATION_QUOTA_EXHAUSTED";
  const isCapacityError =
    generationErrorCode === "RECIPE_DAILY_BUDGET_EXHAUSTED" ||
    generationErrorCode === "RECIPE_SERVICE_CAPACITY_REACHED" ||
    Boolean(errorMessage?.includes("너무 많"));
  const hasActiveEntitlement = Boolean(
    subscription.query.data?.hasActiveEntitlement,
  );
  const isHistoryInitialLoading =
    historyQuery.isPending && historyQuery.data === undefined;
  const justGenerated =
    generationStatus === "success" &&
    Boolean(latestRecommendation) &&
    latestRecommendation?.id === latestGeneratedRecommendationId;
  const showValueMomentOffer = Boolean(
    justGenerated &&
    !hasActiveEntitlement &&
    monetization.access?.offer.personalized &&
    monetization.access.offer.reason === "engaged" &&
    (monetization.access.offer.kind === "jango_plus" ||
      monetization.access.offer.kind === "jango_household"),
  );
  const mealTypeLabel =
    mealTypeOptions.find((option) => option.value === mealType)?.label ??
    "상관없음";
  const preferenceSummary = useMemo(() => {
    if (recipePreferencesQuery.data) {
      return summarizeRecipePreference(recipePreferencesQuery.data);
    }
    if (recipePreferencesQuery.isError) {
      return {
        applied: false,
        text: "맞춤 설정을 확인하러 갈까요?",
      };
    }
    if (recipePreferencesQuery.isLoading) {
      return { applied: false, text: "살펴보는 중이에요" };
    }
    return summarizeRecipePreference(undefined);
  }, [
    recipePreferencesQuery.data,
    recipePreferencesQuery.isError,
    recipePreferencesQuery.isLoading,
  ]);
  const hasRecommendationResult = Boolean(
    latestRecommendation?.recommendations.length,
  );
  const needsRewardedAd = needsRewardedAdToRecommend(monetization.access);
  const canOfferRewardedAd = canContinueWithRewardedAd(monetization.access);
  const recommendationHeroNotices = useMemo(() => {
    const notices = [];
    const statusNotice = {
      id: "status",
      ...getRecommendationHeroStatus({
        isGenerating,
        justGenerated,
        hasRecommendationResult,
        errorMessage,
        isQuotaError,
        isCapacityError,
        canOfferRewardedAd,
        needsIngredients,
      }),
    };

    if (monetization.rewardNotice === "verified") {
      notices.push({
        id: "ad-reward",
        mood: "happy" as const,
        message: "광고 추천권 1회가 지급됐어요",
        supportingMessage: "오늘 추천을 만들 때 바로 사용할 수 있어요.",
        onPress: monetization.dismissRewardNotice,
        accessibilityHint: "확인",
      });
    } else if (monetization.adState === "verifying") {
      notices.push({
        id: "ad-verifying",
        mood: "think" as const,
        message: "광고 보상을 확인하고 있어요",
        supportingMessage:
          "확인되면 추천권에 바로 넣을게요. 남은 광고가 있으면 지금 이어서 볼 수 있어요.",
      });
    }

    notices.push(statusNotice);
    return notices;
  }, [
    canOfferRewardedAd,
    errorMessage,
    hasRecommendationResult,
    isCapacityError,
    isGenerating,
    isQuotaError,
    justGenerated,
    needsIngredients,
    monetization.adState,
    monetization.dismissRewardNotice,
    monetization.rewardNotice,
  ]);
  const quotaCopy = monetization.access
    ? recommendationQuotaCopy(monetization.access)
    : null;
  const personalizedOffer = monetization.access?.offer;
  const showPersonalizedOffer =
    !hasActiveEntitlement &&
    Boolean(personalizedOffer?.personalized) &&
    personalizedOffer?.kind !== "none" &&
    personalizedOffer?.kind !== "rewarded_ad";
  const isAdBusy = monetization.adState === "loading";
  const primaryCtaLabel = isGenerating
    ? "요리 조합을 찾는 중이에요"
    : monetization.adState === "loading"
      ? "광고를 불러오는 중이에요"
      : needsIngredients
        ? "재료 넣으러 갈게요"
        : needsRewardedAd
          ? "광고 보고 추천 받을게요"
          : hasRecommendationResult
            ? "다시 골라볼게요"
            : "추천 받을게요";

  useEffect(() => {
    if (!isQuotaError || !monetization.access) return;
    const eventKey = `${monetization.access.day}:${generationErrorCode ?? "quota"}`;
    if (trackedQuotaEventRef.current === eventKey) return;
    trackedQuotaEventRef.current = eventKey;
    void trackMonetizationEvent({
      event: "quota_exhausted",
      properties: {
        tier: monetization.access.tier,
        error_code: generationErrorCode ?? "unknown",
      },
    }).catch(() => undefined);
  }, [generationErrorCode, isQuotaError, monetization.access]);

  useEffect(() => {
    const day = monetization.access?.day;
    if (!day || trackedScreenDayRef.current === day) return;
    trackedScreenDayRef.current = day;
    void trackMonetizationEvent({
      event: "recommendation_screen_viewed",
      properties: { day },
    }).catch(() => undefined);
  }, [monetization.access?.day]);

  useEffect(() => {
    const offer = monetization.access?.offer;
    if (
      (!isQuotaError && !showValueMomentOffer) ||
      !offer?.personalized ||
      offer.kind === "none"
    )
      return;
    const key = `${monetization.access?.day}:${offer.kind}:${offer.reason}`;
    if (trackedOfferRef.current === key) return;
    trackedOfferRef.current = key;
    void trackMonetizationEvent({
      event: "offer_presented",
      properties: { kind: offer.kind, reason: offer.reason },
    }).catch(() => undefined);
  }, [
    isQuotaError,
    monetization.access?.day,
    monetization.access?.offer,
    showValueMomentOffer,
  ]);

  const handlePrimaryCta = useCallback(() => {
    if (isGenerating || isAdBusy || !inventoryReady) {
      return;
    }

    if (needsIngredients) {
      setEntryMethodVisible(true);
      return;
    }

    if (!hasRecommendationResult || needsRewardedAd) {
      void handleCreateRecommendation();
      return;
    }

    Alert.alert(
      "추천을 한 번 더 받아볼까요?",
      "지금 보신 요리 대신 새로 골라 드릴게요. 오늘의 추천 횟수를 쓸 수 있어요.",
      [
        { text: "지금 요리로 할게요", style: "cancel" },
        {
          text: "다시 골라볼게요",
          onPress: () => {
            void handleCreateRecommendation();
          },
        },
      ],
    );
  }, [
    handleCreateRecommendation,
    hasRecommendationResult,
    inventoryReady,
    isAdBusy,
    isGenerating,
    needsIngredients,
    needsRewardedAd,
  ]);

  const handleMonetizationOffer = useCallback(
    (kind: RecommendationAccess["offer"]["kind"]) => {
      if (kind === "none") return;
      const offer = resolveMonetizationOffer(kind);
      void trackMonetizationEvent({
        event: "offer_selected",
        properties: { kind },
      }).catch(() => undefined);
      setShowOfferAlternatives(false);
      if (offer.action === "rewarded_ad") {
        void handleCreateRecommendation();
      } else if (offer.action === "paid_credits") {
        router.push("/settings/recommendation-credits");
      } else {
        router.push("/settings/subscription");
      }
    },
    [handleCreateRecommendation],
  );

  const handleStartCooking = () => {
    if (!recipeDetail) {
      return;
    }

    const { recommendationId, dishIndex } = recipeDetail;
    setRecipeDetail(null);
    router.push({
      pathname: "/cooking/[recommendationId]",
      params: {
        recommendationId,
        dishIndex: String(dishIndex),
      },
    });
  };

  const handleOpenShopping = () => {
    setRecipeDetail(null);
    router.push("/shopping");
  };

  const handleOpenDetails = (selection: RecipeDetailSelection) => {
    engagementMutation.mutate({
      recommendationId: selection.recommendationId,
      dishIndex: selection.dishIndex,
      action: "view",
    });
    setRecipeDetail(selection);
  };

  const toggleRecipeSection = (key: RecipeSectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setCollapsedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <Screen
      scroll={false}
      contentWidth="wide"
      bottomInsetMode="navigator"
      testID="recommendations-screen"
      contentStyle={styles.screenContent}
      footer={
        recipeView === "favorites" ? (
          <Button
            icon={Sparkles}
            onPress={() => setRecipeView("recommendations")}
            fullWidth
            variant="surface"
          >
            추천으로 돌아갈게요
          </Button>
        ) : (
          <Button
            icon={needsIngredients ? PenLine : Sparkles}
            onPress={handlePrimaryCta}
            loading={isGenerating || monetization.adState === "loading"}
            disabled={
              isGenerating ||
              isAdBusy ||
              (!inventoryReady && !hasRecommendationResult)
            }
            fullWidth
            variant={
              hasRecommendationResult &&
              !isGenerating &&
              !needsRewardedAd &&
              !needsIngredients
                ? "surface"
                : "primary"
            }
          >
            {primaryCtaLabel}
          </Button>
        )
      }
    >
      <View style={styles.kitchenScene}>
        <ImageBackground
          source={kitchenCookingBg}
          style={styles.kitchenSceneBackground}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          importantForAccessibility="no"
        />
        <View
          pointerEvents="none"
          style={styles.kitchenSceneVeil}
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
              refreshing={
                recipeView === "favorites"
                  ? favoritesQuery.isRefetching
                  : historyQuery.isRefetching
              }
              onRefresh={
                recipeView === "favorites"
                  ? favoritesQuery.refetch
                  : historyQuery.refetch
              }
            />
          }
        >
          <SpaceSwitcher />
          {recipeView === "favorites" &&
          monetization.rewardNotice === "verified" ? (
            <FeedbackBanner
              tone="success"
              title="광고 추천권 1회가 지급됐어요"
              description="오늘 추천을 만들 때 바로 사용할 수 있어요."
              actionLabel="확인"
              onAction={monetization.dismissRewardNotice}
              showMascot={false}
            />
          ) : recipeView === "favorites" &&
            monetization.adState === "verifying" ? (
            <FeedbackBanner
              tone="info"
              title="광고 보상을 확인하고 있어요"
              description="확인되면 추천권에 바로 넣을게요. 남은 광고가 있으면 지금 이어서 볼 수 있어요."
              showMascot={false}
            />
          ) : null}
          {recipeView === "recommendations" && showValueMomentOffer ? (
            <RecommendationValueOfferCard
              offerKind={monetization.access!.offer.kind}
              onSelect={handleMonetizationOffer}
            />
          ) : null}
          <View style={styles.recipeViewSwitch}>
            <Pressable
              onPress={() => setRecipeView("recommendations")}
              accessibilityRole="tab"
              accessibilityState={{
                selected: recipeView === "recommendations",
              }}
              style={({ pressed }) => [
                styles.recipeViewOption,
                recipeView === "recommendations" &&
                  styles.recipeViewOptionSelected,
                pressed && styles.recipeViewOptionPressed,
              ]}
            >
              <Sparkles
                color={
                  recipeView === "recommendations"
                    ? colors.primary
                    : colors.subtext
                }
                size={spacing.sm}
                strokeWidth={2.4}
              />
              <AppText
                style={[
                  styles.recipeViewLabel,
                  recipeView === "recommendations" &&
                    styles.recipeViewLabelSelected,
                ]}
              >
                추천받기
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setRecipeView("favorites")}
              accessibilityRole="tab"
              accessibilityState={{ selected: recipeView === "favorites" }}
              style={({ pressed }) => [
                styles.recipeViewOption,
                recipeView === "favorites" && styles.recipeViewOptionSelected,
                pressed && styles.recipeViewOptionPressed,
              ]}
            >
              <Heart
                color={
                  recipeView === "favorites" ? colors.primary : colors.subtext
                }
                fill={recipeView === "favorites" ? colors.primary : "none"}
                size={spacing.sm}
                strokeWidth={2.4}
              />
              <AppText
                style={[
                  styles.recipeViewLabel,
                  recipeView === "favorites" && styles.recipeViewLabelSelected,
                ]}
              >
                즐겨찾기 {favoritesQuery.data?.length ?? 0}
              </AppText>
            </Pressable>
          </View>

          {setFavoriteMutation.error ? (
            <FeedbackBanner
              showMascot={false}
              title="즐겨찾기를 바꾸지 못했어요"
              description={
                getRecommendationErrorMessage(setFavoriteMutation.error) ?? undefined
              }
            />
          ) : null}

          {recipeView === "recommendations" ? (
            <View style={styles.heroCard}>
              <JangoHeroNoticeCarousel notices={recommendationHeroNotices} />

              <View style={styles.optionsSummaryGroup}>
                {quotaCopy ? (
                  <Pressable
                    testID="recommendation-quota-button"
                    onPress={
                      canOfferRewardedAd
                        ? () => {
                            void handleWatchRewardedAdOnly();
                          }
                        : undefined
                    }
                    disabled={canOfferRewardedAd && isAdBusy}
                    accessibilityRole={
                      canOfferRewardedAd ? "button" : "summary"
                    }
                    accessibilityLabel={
                      canOfferRewardedAd
                        ? `광고 보고 추천권 받기. ${quotaCopy.value}`
                        : `${quotaCopy.label} ${quotaCopy.value}`
                    }
                    accessibilityHint={
                      canOfferRewardedAd
                        ? "광고를 보면 추천권 1회를 받을 수 있어요."
                        : undefined
                    }
                    accessibilityState={
                      canOfferRewardedAd ? { disabled: isAdBusy } : undefined
                    }
                    style={({ pressed }) => [
                      styles.optionsSummary,
                      shouldStack && styles.optionsSummaryStacked,
                      canOfferRewardedAd &&
                        pressed &&
                        styles.optionsSummaryPressed,
                    ]}
                  >
                    <View style={styles.optionsSummaryCopy}>
                      <AppText style={styles.optionsSummaryLabel}>
                        {quotaCopy.label}
                      </AppText>
                      <AppText
                        style={styles.optionsSummaryValue}
                        numberOfLines={1}
                      >
                        {quotaCopy.value}
                      </AppText>
                    </View>
                    {canOfferRewardedAd ? (
                      <View
                        style={[
                          styles.optionsSummaryAction,
                          shouldStack && styles.optionsSummaryActionStacked,
                        ]}
                      >
                        <Play
                          color={colors.primary}
                          size={spacing.sm + spacing.xxs}
                          strokeWidth={2.4}
                        />
                        <AppText style={styles.optionsSummaryActionLabel}>
                          {isAdBusy ? "광고 준비 중" : "광고 보기"}
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                <Pressable
                  testID="recommendation-options-button"
                  onPress={() => setShowOptionsSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel="추천 조건 고르기"
                  accessibilityHint="인원, 시간, 끼니를 바꿀 수 있어요."
                  style={({ pressed }) => [
                    styles.optionsSummary,
                    shouldStack && styles.optionsSummaryStacked,
                    pressed && styles.optionsSummaryPressed,
                  ]}
                >
                  <View style={styles.optionsSummaryCopy}>
                    <AppText style={styles.optionsSummaryLabel}>
                      추천 조건
                    </AppText>
                    <AppText
                      style={styles.optionsSummaryValue}
                      numberOfLines={1}
                    >
                      {servings}인 · {maxCookingMinutes}분 · {mealTypeLabel}
                      {useExpiringFirst ? " · 임박 먼저" : ""}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.optionsSummaryAction,
                      shouldStack && styles.optionsSummaryActionStacked,
                    ]}
                  >
                    <SlidersHorizontal
                      color={colors.primary}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <AppText style={styles.optionsSummaryActionLabel}>
                      바꾸기
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  testID="recommendation-preference-summary-button"
                  onPress={() => router.push("/settings/recipe-preferences")}
                  accessibilityRole="button"
                  accessibilityLabel="알레르기·식단 맞추기"
                  accessibilityHint="설정에서 알레르기와 식단을 바꿀 수 있어요."
                  style={({ pressed }) => [
                    styles.optionsSummary,
                    shouldStack && styles.optionsSummaryStacked,
                    pressed && styles.optionsSummaryPressed,
                  ]}
                >
                  <View style={styles.optionsSummaryCopy}>
                    <AppText style={styles.optionsSummaryLabel}>
                      알레르기·식단
                    </AppText>
                    <AppText
                      style={styles.optionsSummaryValue}
                      numberOfLines={1}
                    >
                      {preferenceSummary.text}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.optionsSummaryAction,
                      shouldStack && styles.optionsSummaryActionStacked,
                    ]}
                  >
                    <ShieldCheck
                      color={colors.primary}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <AppText style={styles.optionsSummaryActionLabel}>
                      {preferenceSummary.applied ? "바꾸기" : "맞춰요"}
                    </AppText>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : null}

          {recipeView === "recommendations" &&
          errorMessage &&
          !isGenerating &&
          isQuotaError ? (
            <RecommendationQuotaCard
              canOfferRewardedAd={canOfferRewardedAd}
              hasActiveEntitlement={hasActiveEntitlement}
              showPersonalizedOffer={showPersonalizedOffer}
              offerKind={monetization.access?.offer.kind}
              offerPersonalized={monetization.access?.offer.personalized}
              alternativesLength={
                monetization.access?.offer.alternatives.length ?? 0
              }
              paidCreditsSalesEnabled={Boolean(
                monetization.access?.paidCredits.salesEnabled,
              )}
              subscriptionsEnabled={Boolean(
                monetization.access?.subscriptionsEnabled,
              )}
              isAdBusy={isAdBusy}
              adLoading={monetization.adState === "loading"}
              onCreateRecommendation={handleCreateRecommendation}
              onSelectOffer={handleMonetizationOffer}
              onOpenAlternatives={() => setShowOfferAlternatives(true)}
            />
          ) : null}

          {recipeView === "recommendations" &&
          latestRecommendation &&
          !isGenerating ? (
            <RecipeSection
              title="이번에 골라본 요리"
              count={latestRecommendation.recommendations.length}
              collapsed={Boolean(collapsedSections.latest)}
              onToggle={() => toggleRecipeSection("latest")}
            >
              {latestRecommendation.recommendations.length ? (
                <RecipeCardGrid embedded>
                  {latestRecommendation.recommendations.map((dish, index) => (
                    <RecipeCard
                      key={`${latestRecommendation.id}-${dish.title}-${index}`}
                      embedded
                      showDivider={
                        index < latestRecommendation.recommendations.length - 1
                      }
                      dish={dish}
                      badgeLabel={String(index + 1)}
                      inventorySnapshot={latestRecommendation.inventorySnapshot}
                      onOpenDetails={() =>
                        handleOpenDetails({
                          recommendationId: latestRecommendation.id,
                          dishIndex: index,
                          dish,
                          inventorySnapshot:
                            latestRecommendation.inventorySnapshot,
                        })
                      }
                      isFavorite={favoriteKeys.has(
                        getRecipeFavoriteKey(latestRecommendation.id, index),
                      )}
                      isFavoritePending={
                        setFavoriteMutation.isPending &&
                        setFavoriteMutation.variables?.recommendationId ===
                          latestRecommendation.id &&
                        setFavoriteMutation.variables.dishIndex === index
                      }
                      onToggleFavorite={(favorite) =>
                        setFavoriteMutation.mutate({
                          recommendationId: latestRecommendation.id,
                          dishIndex: index,
                          dish,
                          inventorySnapshot:
                            latestRecommendation.inventorySnapshot,
                          favorite,
                        })
                      }
                    />
                  ))}
                </RecipeCardGrid>
              ) : (
                <View style={styles.recipeSectionInset}>
                  <EmptyState
                    variant="plain"
                    mood="empty"
                    title="이번에는 딱 맞는 요리가 없어요"
                    description="조건을 조금 바꾸거나, 재료를 더 넣은 뒤 다시 부탁해 주세요."
                  />
                </View>
              )}
            </RecipeSection>
          ) : null}

          {recipeView === "recommendations" &&
          previousRecommendations.length > 0 &&
          !isGenerating ? (
            <RecipeSection
              title="이전 추천"
              count={previousRecommendations.length}
              collapsed={Boolean(collapsedSections.previous)}
              onToggle={() => toggleRecipeSection("previous")}
            >
              <View>
                {previousRecommendations.map((recommendation, index) => (
                  <Pressable
                    key={recommendation.id}
                    onPress={() => setHistoryRecommendation(recommendation)}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatCreatedAt(recommendation.createdAt)} 추천 다시 볼게요`}
                    accessibilityHint="그때 받아 둔 요리를 다시 열어 볼 수 있어요."
                    style={({ pressed }) => [
                      styles.historyRow,
                      shouldStack && styles.historyRowStacked,
                      index < previousRecommendations.length - 1 &&
                        styles.historyRowDivider,
                      pressed && styles.historyRowPressed,
                    ]}
                  >
                    <View style={styles.historyCopy}>
                      <AppText style={styles.historyTitle}>
                        {formatCreatedAt(recommendation.createdAt)} 추천
                      </AppText>
                      <AppText
                        style={styles.historyDescription}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {formatHistoryPreview(recommendation)}
                      </AppText>
                    </View>
                    <View
                      style={shouldStack ? styles.historyActionStacked : undefined}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      <Archive
                        color={colors.primary}
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </RecipeSection>
          ) : null}

          {recipeView === "recommendations" &&
          isHistoryInitialLoading &&
          !isGenerating &&
          !errorMessage ? (
            <View
              style={styles.favoriteLoading}
              accessibilityLabel="추천을 불러오고 있어요"
            >
              <AppText style={styles.favoriteLoadingText}>
                추천을 불러오고 있어요…
              </AppText>
            </View>
          ) : null}

          {recipeView === "recommendations" &&
          !isHistoryInitialLoading &&
          !latestRecommendation &&
          !isGenerating &&
          !errorMessage ? (
            <EmptyState
              mood="empty"
              title={
                needsIngredients
                  ? "아직 냉장고가 비어 있어요"
                  : "아직 추천이 없어요"
              }
              description={
                needsIngredients
                  ? "재료를 넣으면 장고가 오늘 요리를 골라 드릴게요."
                  : "아래 버튼을 누르면 장고가 냉장고 재료로 요리를 골라줄게요."
              }
            />
          ) : null}

          {recipeView === "favorites" ? (
            <RecipeSection
              title="즐겨찾는 요리"
              count={favoritesQuery.data?.length ?? 0}
              collapsed={Boolean(collapsedSections.favorites)}
              onToggle={() => toggleRecipeSection("favorites")}
            >
              {favoritesQuery.isPending ? (
                <View
                  style={[
                    styles.favoriteLoading,
                    styles.favoriteLoadingEmbedded,
                  ]}
                  accessibilityLabel="즐겨찾기를 불러오고 있어요"
                >
                  <AppText style={styles.favoriteLoadingText}>
                    즐겨찾기를 불러오고 있어요…
                  </AppText>
                </View>
              ) : favoritesQuery.error ? (
                <View style={styles.recipeSectionInset}>
                  <FeedbackBanner
                    showMascot={false}
                    title="즐겨찾기를 불러오지 못했어요"
                    description={
                      getRecommendationErrorMessage(favoritesQuery.error) ?? undefined
                    }
                    actionLabel="다시 불러오기"
                    onAction={() => {
                      void favoritesQuery.refetch();
                    }}
                  />
                </View>
              ) : favoritesQuery.data?.length ? (
                <RecipeCardGrid embedded>
                  {favoritesQuery.data.map((favorite, favoriteIndex) => (
                    <RecipeCard
                      key={favorite.id}
                      embedded
                      showDivider={
                        favoriteIndex < favoritesQuery.data.length - 1
                      }
                      dish={favorite.dish}
                      badgeLabel={String(favoriteIndex + 1)}
                      inventorySnapshot={favorite.inventorySnapshot}
                      onOpenDetails={() =>
                        setRecipeDetail({
                          recommendationId: favorite.sourceRecommendationId,
                          dishIndex: favorite.sourceDishIndex,
                          dish: favorite.dish,
                          inventorySnapshot: favorite.inventorySnapshot,
                        })
                      }
                      isFavorite
                      isFavoritePending={
                        setFavoriteMutation.isPending &&
                        setFavoriteMutation.variables?.recommendationId ===
                          favorite.sourceRecommendationId &&
                        setFavoriteMutation.variables.dishIndex ===
                          favorite.sourceDishIndex
                      }
                      onToggleFavorite={(isFavorite) =>
                        setFavoriteMutation.mutate({
                          recommendationId: favorite.sourceRecommendationId,
                          dishIndex: favorite.sourceDishIndex,
                          dish: favorite.dish,
                          inventorySnapshot: favorite.inventorySnapshot,
                          favorite: isFavorite,
                        })
                      }
                    />
                  ))}
                </RecipeCardGrid>
              ) : (
                <View style={styles.recipeSectionInset}>
                  <EmptyState
                    variant="plain"
                    icon={Heart}
                    title="아직 즐겨찾는 요리가 없어요"
                    description="추천 요리의 하트를 누르면 이곳에 모아둘게요."
                    actionLabel="추천 보러 가기"
                    onAction={() => setRecipeView("recommendations")}
                  />
                </View>
              )}
            </RecipeSection>
          ) : null}
        </ScrollView>
      </View>

      <BottomSheet
        visible={entryMethodVisible}
        onClose={() => setEntryMethodVisible(false)}
        title="어떻게 넣을까요?"
        description="바코드를 비추거나, 직접 입력해서 냉장고에 넣을 수 있어요."
        mascotMood="idle"
      >
        <View style={styles.entryMethodActions}>
          <Button
            icon={Barcode}
            onPress={() => {
              setEntryMethodVisible(false);
              if (activeSpaceId) {
                clearPrefill(activeSpaceId);
              }
              router.push("/scanner");
            }}
            fullWidth
          >
            바코드로 넣을래요
          </Button>
          <Button
            icon={PenLine}
            onPress={() => {
              setEntryMethodVisible(false);
              if (activeSpaceId) {
                clearPrefill(activeSpaceId);
              }
              router.push("/register");
            }}
            fullWidth
            variant="surface"
          >
            직접 입력할게요
          </Button>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        mascotMood="idle"
        title="오늘은 어떤 요리로 할까요?"
        description="인원·시간만 바꿔도 장고가 다시 골라 드려요."
        footer={
          <Button onPress={() => setShowOptionsSheet(false)} fullWidth>
            이걸로 할게요
          </Button>
        }
      >
        <OptionGroup icon={Users} title="몇 명이서 먹나요?">
          <View style={styles.pillRow}>
            {servingOptions.map((value) => (
              <Pill
                key={value}
                label={`${value}인`}
                selected={servings === value}
                onPress={() => setServings(value)}
              />
            ))}
          </View>
        </OptionGroup>

        <OptionGroup icon={Clock3} title="얼마나 걸려도 괜찮나요?">
          <View style={styles.pillRow}>
            {timeOptions.map((value) => (
              <Pill
                key={value}
                label={`${value}분`}
                selected={maxCookingMinutes === value}
                onPress={() => setMaxCookingMinutes(value)}
              />
            ))}
          </View>
        </OptionGroup>

        <OptionGroup icon={Utensils} title="어떤 식사인가요?">
          <View style={styles.pillRow}>
            {mealTypeOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={mealType === option.value}
                onPress={() => setMealType(option.value)}
              />
            ))}
          </View>
        </OptionGroup>

        <ExpiringFirstToggle
          selected={useExpiringFirst}
          onToggle={() => setUseExpiringFirst((value) => !value)}
        />
      </BottomSheet>

      <RecommendationOfferAlternativesSheet
        visible={showOfferAlternatives}
        alternatives={monetization.access?.offer.alternatives ?? []}
        onClose={() => setShowOfferAlternatives(false)}
        onSelectOffer={handleMonetizationOffer}
      />

      <BottomSheet
        visible={showAiNotice}
        onClose={closeAiNotice}
        mascotMood="idle"
        title="추천에 쓸 정보를 확인할까요?"
        description="장고가 요리를 고를 때 어떤 정보가 쓰이는지 짧게 알려드릴게요."
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={closeAiNotice}
              fullWidth
            >
              다음에 할게요
            </Button>
            <Button
              onPress={handleAcceptAiNotice}
              loading={isAcceptingAiNotice}
              fullWidth
            >
              동의하고 추천 받을게요
            </Button>
          </View>
        }
      >
        <AppText style={styles.noticeBody}>
          요리 추천을 만들 때 재료 이름, 종류, 수량과 단위, 보관 위치, 유통기한,
          만료까지 남은 일수, 고른 조건과 저장한 알레르기·식단·조리도구 설정,
          최근 즐겨찾기·조리·관심없음 요약이 장고 서버를 거쳐 외부 요리
          도우미(OpenAI)로 전달돼요. 나온 추천과 그때의 재료 목록, 추천 행동은
          기록과 더 나은 추천을 위해 내 계정에 남겨 둬요.
        </AppText>
        <AppText style={styles.noticeFootnote}>
          외부 요리 도우미로 보낸 정보는 기본적으로 모델 학습에 쓰이지 않아요.
          다만 서비스 안전과 이상 이용 확인을 위해 잠깐 보관될 수 있어요.
        </AppText>
      </BottomSheet>

      <BottomSheet
        visible={Boolean(historyRecommendation)}
        onClose={() => setHistoryRecommendation(null)}
        mascotMood="happy"
        title={
          historyRecommendation
            ? `${formatCreatedAt(historyRecommendation.createdAt)} 추천`
            : "이전 추천"
        }
        description={
          historyRecommendation
            ? formatRecommendationContext(historyRecommendation)
            : "예전에 받아 둔 요리를 다시 살펴볼 수 있어요."
        }
        footer={
          <Button onPress={() => setHistoryRecommendation(null)} fullWidth>
            닫을게요
          </Button>
        }
      >
        {historyRecommendation?.recommendations.length ? (
          <RecipeCardGrid>
            {historyRecommendation.recommendations.map((dish, index) => (
              <RecipeCard
                key={`${historyRecommendation.id}-${dish.title}-${index}`}
                dish={dish}
                badgeLabel={String(index + 1)}
                inventorySnapshot={historyRecommendation.inventorySnapshot}
                onOpenDetails={() => {
                  const detail = {
                    recommendationId: historyRecommendation.id,
                    dishIndex: index,
                    dish,
                    inventorySnapshot: historyRecommendation.inventorySnapshot,
                  };

                  setHistoryRecommendation(null);
                  engagementMutation.mutate({
                    recommendationId: historyRecommendation.id,
                    dishIndex: index,
                    action: "view",
                  });
                  setTimeout(
                    () => setRecipeDetail(detail),
                    SHEET_TRANSITION_DELAY_MS,
                  );
                }}
                isFavorite={favoriteKeys.has(
                  getRecipeFavoriteKey(historyRecommendation.id, index),
                )}
                isFavoritePending={
                  setFavoriteMutation.isPending &&
                  setFavoriteMutation.variables?.recommendationId ===
                    historyRecommendation.id &&
                  setFavoriteMutation.variables.dishIndex === index
                }
                onToggleFavorite={(favorite) =>
                  setFavoriteMutation.mutate({
                    recommendationId: historyRecommendation.id,
                    dishIndex: index,
                    dish,
                    inventorySnapshot: historyRecommendation.inventorySnapshot,
                    favorite,
                  })
                }
              />
            ))}
          </RecipeCardGrid>
        ) : (
          <EmptyState
            variant="plain"
            showMascot={false}
            mood="empty"
            title="그때는 딱 맞는 요리가 없었어요"
            description="조건을 조금 바꿔 다시 부탁해 볼 수 있어요."
          />
        )}
      </BottomSheet>

      <RecipeDetailSheet
        selection={recipeDetail}
        onClose={() => setRecipeDetail(null)}
        onStartCooking={handleStartCooking}
        onOpenShopping={handleOpenShopping}
      />
    </Screen>
  );
}

function RecipeSection({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const heading = `${title} ${count}건`;

  return (
    <View style={styles.recipeSection}>
      <View
        style={[
          styles.recipeSectionHeader,
          !collapsed && styles.recipeSectionHeaderExpanded,
        ]}
        accessibilityRole="header"
        accessibilityLabel={heading}
      >
        <AppText
          variant="bodySmall"
          scaleRole="chrome"
          densityAware={false}
          numberOfLines={1}
          style={styles.recipeSectionTitle}
        >
          {heading}
        </AppText>
        <Pressable
          onPress={onToggle}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={
            collapsed ? `${title} 펼쳐 볼게요` : `${title} 접을게요`
          }
          accessibilityHint={
            collapsed
              ? "이 분류의 요리를 펼쳐 볼 수 있어요."
              : "이 분류의 요리를 접어요."
          }
          accessibilityState={{ expanded: !collapsed }}
          style={({ pressed }) => [
            styles.recipeSectionToggle,
            pressed && styles.optionsSummaryPressed,
          ]}
        >
          <AppText
            variant="bodySmall"
            scaleRole="chrome"
            densityAware={false}
            numberOfLines={1}
          >
            {collapsed ? "펼치기" : "접기"}
          </AppText>
          {collapsed ? (
            <ChevronDown
              color={colors.text}
              size={typography.bodySmall.fontSize}
              strokeWidth={2.4}
            />
          ) : (
            <ChevronUp
              color={colors.text}
              size={typography.bodySmall.fontSize}
              strokeWidth={2.4}
            />
          )}
        </Pressable>
      </View>
      {collapsed ? null : (
        <View style={styles.recipeSectionBody}>{children}</View>
      )}
    </View>
  );
}

function OptionGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.optionGroup}>
      <View style={styles.optionHeader}>
        <Icon color={colors.subtext} size={spacing.sm} strokeWidth={2.4} />
        <AppText style={styles.optionTitle}>{title}</AppText>
      </View>
      {children}
    </View>
  );
}

function ExpiringFirstToggle({
  selected,
  onToggle,
}: {
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <View
      style={[styles.expiringToggle, selected && styles.expiringToggleSelected]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: selected }}
        accessibilityLabel="임박 재료를 먼저 쓸까요?"
        accessibilityHint="켜 두면 유통기한이 가까운 재료로 요리를 먼저 골라 드려요."
        style={({ pressed }) => [
          styles.expiringToggleMain,
          pressed && !selected && styles.expiringTogglePressed,
        ]}
      >
        <Timer
          color={selected ? colors.warning : colors.subtext}
          size={spacing.sm}
          strokeWidth={2.4}
          style={styles.expiringToggleIcon}
        />
        <View style={styles.expiringToggleCopy}>
          <AppText variant="bodySmall" style={styles.optionTitle}>
            임박 재료를 먼저 쓸까요?
          </AppText>
          <AppText variant="label" tone="subtext">
            유통기한이 가까운 재료로 요리를 먼저 골라 드려요.
          </AppText>
        </View>
      </Pressable>
      <View style={styles.expiringToggleIcon}>
        <Switch
          value={selected}
          onValueChange={onToggle}
          accessible={false}
          importantForAccessibility="no"
          trackColor={{
            false: colors.border,
            true: colors.warningSoft,
          }}
          thumbColor={selected ? colors.warning : colors.mutedSurface}
        />
      </View>
    </View>
  );
}

function RecipeCardGrid({
  children,
  embedded = false,
}: {
  children: ReactNode;
  embedded?: boolean;
}) {
  const { isRegular } = useResponsiveLayout();
  return (
    <View
      style={[
        styles.recipeCardGrid,
        embedded && styles.recipeCardGridEmbedded,
        !embedded && isRegular && styles.recipeCardGridRegular,
      ]}
    >
      {children}
    </View>
  );
}

function RecipeCard({
  dish,
  badgeLabel,
  inventorySnapshot,
  onOpenDetails,
  isFavorite = false,
  isFavoritePending = false,
  onToggleFavorite,
  embedded = false,
  showDivider = false,
}: {
  dish: RecipeRecommendationDish;
  badgeLabel?: string;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  onOpenDetails: () => void;
  isFavorite?: boolean;
  isFavoritePending?: boolean;
  onToggleFavorite?: (favorite: boolean) => void;
  embedded?: boolean;
  showDivider?: boolean;
}) {
  const { shouldStack, isRegular } = useResponsiveLayout();
  const highlightIngredients = getHighlightedIngredients(
    dish,
    inventorySnapshot,
  );
  const ingredientPreview = formatIngredientPreview(highlightIngredients);

  return (
    <View
      style={[
        styles.recipeCard,
        shouldStack && styles.recipeCardStacked,
        !embedded && isRegular && styles.recipeCardRegular,
        embedded && styles.recipeCardEmbedded,
        showDivider && styles.recipeCardDivider,
      ]}
    >
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`${dish.title} 레시피 상세 보기`}
        accessibilityHint="사용할 재료와 조리 순서를 확인합니다."
        style={({ pressed }) => [
          styles.recipeCardMain,
          pressed && styles.recipeCardMainPressed,
        ]}
      >
        <View
          style={[
            styles.recipeCompactTitleRow,
            shouldStack && styles.recipeCompactTitleRowStacked,
          ]}
        >
          <View style={styles.recipeNumberBadge}>
            <AppText
              variant="caption"
              tone="primary"
              scaleRole="chrome"
              densityAware={false}
              style={styles.recipeNumberBadgeText}
            >
              {badgeLabel ?? "1"}
            </AppText>
          </View>
          <AppText
            variant="bodyStrong"
            numberOfLines={shouldStack ? undefined : 1}
            ellipsizeMode="tail"
            style={styles.recipeTitle}
          >
            {dish.title}
          </AppText>
        </View>

        <AppText
          variant="caption"
          tone="subtext"
          numberOfLines={shouldStack ? undefined : 1}
          ellipsizeMode="tail"
        >
          {formatDishMeta(dish)}
        </AppText>

        <AppText
          variant="caption"
          tone="subtext"
          numberOfLines={shouldStack ? undefined : 1}
          ellipsizeMode="tail"
        >
          {ingredientPreview}
        </AppText>
      </Pressable>

      {onToggleFavorite ? (
        <Pressable
          onPress={() => onToggleFavorite(!isFavorite)}
          disabled={isFavoritePending}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite
              ? `${dish.title} 즐겨찾기에서 빼기`
              : `${dish.title} 즐겨찾기에 저장`
          }
          accessibilityState={{
            selected: isFavorite,
            disabled: isFavoritePending,
          }}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.favoriteButton,
            shouldStack && styles.favoriteButtonStacked,
            isFavorite && styles.favoriteButtonSelected,
            pressed && styles.favoriteButtonPressed,
            isFavoritePending && styles.favoriteButtonPending,
          ]}
        >
          <Heart
            color={isFavorite ? colors.primary : colors.subtext}
            fill={isFavorite ? colors.primary : "none"}
            size={spacing.md}
            strokeWidth={2.4}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function formatRecommendationContext(recommendation: RecipeRecommendation) {
  const inventoryCount = recommendation.inventorySnapshot.length;
  const expiringCount = recommendation.inventorySnapshot.filter(
    (item) => item.daysUntilExpiry <= EXPIRING_DAYS_THRESHOLD,
  ).length;

  if (recommendation.request.useExpiringFirst && expiringCount > 0) {
    return `임박 재료 ${expiringCount}개 먼저 · 보관 재료 ${inventoryCount}개 기준`;
  }

  return `보관 재료 ${inventoryCount}개 기준`;
}

function formatHistoryPreview(recommendation: RecipeRecommendation) {
  const titles = recommendation.recommendations
    .map((dish) => dish.title)
    .filter(Boolean);

  if (!titles.length) {
    return `보관 재료 ${recommendation.inventorySnapshot.length}개 기준 · 그때는 딱 맞는 요리가 없었어요`;
  }

  const previewTitles = titles.slice(0, 2).join(" · ");
  const remainingCount = titles.length - 2;

  if (remainingCount > 0) {
    return `${previewTitles} 외 ${remainingCount}개`;
  }

  return previewTitles;
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    gap: spacing.none,
    paddingHorizontal: spacing.none,
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  kitchenScene: {
    flex: 1,
    overflow: "hidden",
  },
  kitchenSceneBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  kitchenSceneVeil: {
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
  recipeViewSwitch: {
    minHeight: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    padding: spacing.xxs,
    flexDirection: "row",
    gap: spacing.xxs,
  },
  recipeViewOption: {
    flex: 1,
    minHeight: touchTarget.min,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  recipeViewOptionSelected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeViewOptionPressed: {
    opacity: 0.8,
  },
  recipeViewLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  recipeViewLabelSelected: {
    color: colors.primary,
  },
  heroCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  optionsSummary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionsSummaryGroup: {
    gap: spacing.xs,
  },
  optionsSummaryStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  optionsSummaryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  optionsSummaryCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  optionsSummaryLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  optionsSummaryValue: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  optionsSummaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  optionsSummaryActionStacked: {
    alignSelf: "flex-end",
  },
  optionsSummaryActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.primary,
  },
  recipeSection: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  recipeSectionHeader: {
    minHeight: touchTarget.min,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  recipeSectionHeaderExpanded: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recipeSectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  recipeSectionToggle: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
  },
  recipeSectionBody: {
    backgroundColor: colors.surface,
  },
  recipeSectionInset: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  favoriteLoading: {
    minHeight: spacing.xxxl,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  favoriteLoadingEmbedded: {
    borderWidth: 0,
    borderRadius: radius.none,
    backgroundColor: colors.surface,
  },
  favoriteLoadingText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  historyRow: {
    minHeight: touchTarget.min,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  historyRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  historyRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  historyRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  historyTitle: {
    fontSize: typography.bodyStrong.fontSize,
    lineHeight: typography.bodyStrong.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  historyDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  historyActionStacked: {
    alignSelf: "flex-end",
  },
  recipeCardGrid: {
    gap: spacing.xxs,
  },
  recipeCardGridEmbedded: {
    gap: spacing.none,
  },
  recipeCardGridRegular: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  recipeCard: {
    minHeight: touchTarget.min * 2,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  recipeCardEmbedded: {
    borderWidth: 0,
    borderRadius: radius.none,
    backgroundColor: colors.surface,
  },
  recipeCardDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recipeCardStacked: {
    flexDirection: "column",
  },
  recipeCardRegular: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
  },
  recipeCardMain: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  recipeCardMainPressed: {
    backgroundColor: colors.surfacePressed,
  },
  recipeCompactTitleRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  recipeCompactTitleRowStacked: {
    alignItems: "flex-start",
  },
  recipeNumberBadge: {
    minWidth: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xxs,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeNumberBadgeText: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  recipeTitle: {
    flex: 1,
    minWidth: 0,
  },
  favoriteButton: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
    marginRight: spacing.xs,
  },
  favoriteButtonStacked: {
    alignSelf: "flex-end",
    marginBottom: spacing.xs,
  },
  favoriteButtonSelected: {
    backgroundColor: colors.primarySoft,
  },
  favoriteButtonPressed: {
    opacity: 0.75,
  },
  favoriteButtonPending: {
    opacity: 0.55,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  optionTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  expiringToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  expiringToggleSelected: {
    borderColor: colors.warningSoft,
    backgroundColor: colors.warningSoft,
  },
  expiringToggleMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  expiringTogglePressed: {
    backgroundColor: colors.surfacePressed,
  },
  expiringToggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  expiringToggleIcon: {
    flexShrink: 0,
  },
  sheetFooter: {
    gap: spacing.sm,
  },
  entryMethodActions: {
    gap: spacing.xs,
  },
  noticeBody: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  noticeFootnote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
});
