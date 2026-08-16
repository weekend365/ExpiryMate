import {
  formatBaseQuantity,
  type RecommendationAccess,
  type RecipeInventorySnapshotItem,
  type RecipeMealType,
  type RecipeRecommendation,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Heart,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  ImageBackground,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import kitchenCookingBg from "../../assets/backgrounds/kitchen-cooking-bg.png";
import { AppText } from "../../src/components/AppText";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
} from "../../src/features/privacy/use-privacy";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import { resolveMonetizationOffer } from "../../src/features/monetization/monetization-offer";
import {
  canContinueWithRewardedAd,
  canGenerateWithoutRewardedAd,
  needsRewardedAdToRecommend,
  parseRecommendationAccess,
} from "../../src/features/monetization/recommendation-access";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { OptionalMissingIngredientsCard } from "../../src/features/affiliate/optional-missing-ingredients";
import {
  getRecipeFavoriteKey,
  useRecipeFavorites,
  useRecipeEngagement,
  useRecipeRecommendations,
  useSetRecipeFavorite,
} from "../../src/features/recipes/use-recipe-recommendations";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import type { RecipeRecommendationPayload } from "../../src/services/api";
import { ApiError, trackMonetizationEvent } from "../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";

const servingOptions = [1, 2, 3, 4];
const timeOptions = [15, 30, 60];
const COLLAPSED_INGREDIENT_PREVIEW_COUNT = 2;
const EXPIRING_DAYS_THRESHOLD = 7;
const PREVIOUS_RECOMMENDATION_LIMIT = 5;
const SHEET_TRANSITION_DELAY_MS = 320;
type RecipeView = "recommendations" | "favorites";
type RecipeSectionKey = "latest" | "previous" | "favorites";

type HighlightIngredient = {
  key: string;
  name: string;
  amountLabel: string | null;
  daysUntilExpiry: number | null;
  isExpiring: boolean;
};

type RecipeDetailSelection = {
  recommendationId: string;
  dishIndex: number;
  dish: RecipeRecommendationDish;
  inventorySnapshot: RecipeInventorySnapshotItem[];
};

const mealTypeOptions: Array<{
  value: RecipeMealType;
  label: string;
}> = [
  { value: "any", label: "상관없음" },
  { value: "breakfast", label: "아침" },
  { value: "lunch", label: "점심" },
  { value: "dinner", label: "저녁" },
  { value: "snack", label: "간식" },
];

const difficultyLabels: Record<RecipeRecommendationDish["difficulty"], string> =
  {
    easy: "쉬움",
    medium: "보통",
    hard: "어려움",
  };
const spiceLevelLabels = {
  none: "안 매움",
  mild: "순한맛",
  medium: "보통맛",
  hot: "매운맛",
} as const;
const equipmentLabels = {
  stovetop: "가스/인덕션",
  microwave: "전자레인지",
  oven: "오븐",
  air_fryer: "에어프라이어",
} as const;

export default function RecommendationsScreen() {
  const { shouldStack } = useResponsiveLayout();
  const params = useLocalSearchParams<{ autoGenerateAt?: string }>();
  const historyQuery = useRecipeRecommendations();
  const favoritesQuery = useRecipeFavorites();
  const setFavoriteMutation = useSetRecipeFavorite();
  const engagementMutation = useRecipeEngagement();
  const {
    status: generationStatus,
    latestGeneratedRecommendation,
    latestGeneratedRecommendationId,
    errorMessage: generationErrorMessage,
    errorCode: generationErrorCode,
    generateRecipeRecommendation,
  } = useRecipeGeneration();
  const privacyStatusQuery = usePrivacyStatus();
  const acceptAiDataNoticeMutation = useAcceptAiDataNotice();
  const subscription = useSubscriptionEntitlement();
  const monetization = useMonetization();
  const [servings, setServings] = useState(2);
  const [maxCookingMinutes, setMaxCookingMinutes] = useState(30);
  const [mealType, setMealType] = useState<RecipeMealType>("any");
  const [useExpiringFirst, setUseExpiringFirst] = useState(true);
  const [recipeView, setRecipeView] = useState<RecipeView>("recommendations");
  const [collapsedSections, setCollapsedSections] = useState<
    Partial<Record<RecipeSectionKey, boolean>>
  >({});
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [showOfferAlternatives, setShowOfferAlternatives] = useState(false);
  const [historyRecommendation, setHistoryRecommendation] =
    useState<RecipeRecommendation | null>(null);
  const [recipeDetail, setRecipeDetail] =
    useState<RecipeDetailSelection | null>(null);
  const [pendingPayload, setPendingPayload] =
    useState<RecipeRecommendationPayload | null>(null);
  const handledAutoGenerateRef = useRef<string | null>(null);
  const pendingGenerateAfterRewardRef =
    useRef<RecipeRecommendationPayload | null>(null);
  const trackedQuotaEventRef = useRef<string | null>(null);
  const trackedScreenDayRef = useRef<string | null>(null);
  const trackedOfferRef = useRef<string | null>(null);
  const isGenerating = generationStatus === "pending";

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
  const historyErrorMessage = getErrorMessage(historyQuery.error);
  const errorMessage = generationErrorMessage ?? historyErrorMessage;
  const isHistoryLoadError = Boolean(
    historyQuery.error && !generationErrorMessage,
  );
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
  const hasRecommendationResult = Boolean(
    latestRecommendation?.recommendations.length,
  );
  const needsRewardedAd = needsRewardedAdToRecommend(monetization.access);
  const canOfferRewardedAd = canContinueWithRewardedAd(monetization.access);
  const personalizedOffer = monetization.access?.offer;
  const showPersonalizedOffer =
    !hasActiveEntitlement &&
    Boolean(personalizedOffer?.personalized) &&
    personalizedOffer?.kind !== "none" &&
    personalizedOffer?.kind !== "rewarded_ad";
  const isAdBusy = monetization.adState !== "idle";
  const primaryCtaLabel = isGenerating
    ? "요리 조합을 찾는 중이에요"
    : monetization.adState === "loading"
      ? "광고를 불러오는 중이에요"
      : monetization.adState === "verifying"
        ? "광고 보상을 확인 중이에요"
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
    ) return;
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

  const buildRecommendationPayload = useCallback(
    (): RecipeRecommendationPayload => ({
      servings,
      maxCookingMinutes,
      mealType,
      useExpiringFirst,
    }),
    [maxCookingMinutes, mealType, servings, useExpiringFirst],
  );

  const startRecommendation = useCallback(
    async (payload: RecipeRecommendationPayload) => {
      if (needsRewardedAdToRecommend(monetization.access)) {
        if (monetization.adState !== "idle") {
          return;
        }
        pendingGenerateAfterRewardRef.current = payload;
        try {
          const result = await monetization.watchRewardedAd();
          if (result !== "verified") {
            return;
          }
          const queuedPayload = pendingGenerateAfterRewardRef.current;
          pendingGenerateAfterRewardRef.current = null;
          if (!queuedPayload) {
            return;
          }
          await generateRecipeRecommendation(queuedPayload);
          return;
        } catch (error) {
          pendingGenerateAfterRewardRef.current = null;
          const accessFromError =
            error instanceof ApiError
              ? parseRecommendationAccess(error.details)
              : null;
          if (canGenerateWithoutRewardedAd(accessFromError ?? monetization.access)) {
            await generateRecipeRecommendation(payload);
            return;
          }
          Alert.alert(
            "광고를 완료하지 못했어요",
            getErrorMessage(error) ?? "잠시 뒤에 다시 시도해 주세요.",
          );
          return;
        }
      }

      pendingGenerateAfterRewardRef.current = null;
      await generateRecipeRecommendation(payload);
    },
    [generateRecipeRecommendation, monetization],
  );

  const handleCreateRecommendation = useCallback(async () => {
    const payload = buildRecommendationPayload();
    const privacyStatus =
      privacyStatusQuery.data ?? (await privacyStatusQuery.refetch()).data;

    if (!privacyStatus?.hasAcceptedCurrentAiDataNotice) {
      setPendingPayload(payload);
      setShowAiNotice(true);
      return;
    }

    await startRecommendation(payload);
  }, [buildRecommendationPayload, privacyStatusQuery, startRecommendation]);

  const handlePrimaryCta = useCallback(() => {
    if (isGenerating || isAdBusy) {
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
    isAdBusy,
    isGenerating,
    needsRewardedAd,
  ]);

  const handleAcceptAiNotice = useCallback(async () => {
    const payload = pendingPayload ?? buildRecommendationPayload();
    await acceptAiDataNoticeMutation.mutateAsync();
    setShowAiNotice(false);
    setPendingPayload(null);
    await startRecommendation(payload);
  }, [
    acceptAiDataNoticeMutation,
    buildRecommendationPayload,
    pendingPayload,
    startRecommendation,
  ]);

  const handleWatchRewardedAdOnly = useCallback(async () => {
    if (monetization.adState !== "idle") {
      return;
    }
    try {
      await monetization.watchRewardedAd();
    } catch (error) {
      Alert.alert(
        "광고를 완료하지 못했어요",
        getErrorMessage(error) ?? "잠시 뒤에 다시 시도해 주세요.",
      );
    }
  }, [monetization]);

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

  useEffect(() => {
    const autoGenerateAt = Array.isArray(params.autoGenerateAt)
      ? params.autoGenerateAt[0]
      : params.autoGenerateAt;

    if (!autoGenerateAt || handledAutoGenerateRef.current === autoGenerateAt) {
      return;
    }

    handledAutoGenerateRef.current = autoGenerateAt;

    if (isGenerating) {
      return;
    }

    void handleCreateRecommendation();
  }, [handleCreateRecommendation, isGenerating, params.autoGenerateAt]);

  useEffect(() => {
    const payload = pendingGenerateAfterRewardRef.current;
    if (
      !payload ||
      isGenerating ||
      monetization.adState === "loading" ||
      (monetization.access?.rewardedAds.creditsAvailable ?? 0) < 1
    ) {
      return;
    }

    pendingGenerateAfterRewardRef.current = null;
    void generateRecipeRecommendation(payload);
  }, [
    generateRecipeRecommendation,
    isGenerating,
    monetization.access?.rewardedAds.creditsAvailable,
    monetization.adState,
  ]);

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
            icon={Sparkles}
            onPress={handlePrimaryCta}
            loading={isGenerating || monetization.adState === "loading"}
            disabled={isGenerating || isAdBusy}
            fullWidth
            variant={
              hasRecommendationResult && !isGenerating && !needsRewardedAd
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
          contentContainerStyle={styles.scrollContent}
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
      {monetization.rewardNotice === "verified" ? (
        <FeedbackBanner
          tone="success"
          title="광고 추천권 1회가 지급됐어요"
          description="오늘 추천을 만들 때 바로 사용할 수 있어요."
          actionLabel="확인"
          onAction={monetization.dismissRewardNotice}
          showMascot={false}
        />
      ) : null}
      {recipeView === "recommendations" && monetization.access ? (
        <View style={styles.usageCard}>
          <View style={styles.usageCopy}>
            <Text style={styles.usageTitle}>
              {monetization.access.tier !== "free"
                ? `오늘 추천 ${monetization.access.used}/${monetization.access.dailyLimit}`
                : `오늘 무료 추천 ${monetization.access.free.used}/${monetization.access.free.limit}`}
            </Text>
            <Text style={styles.usageDescription}>
              {monetization.access.tier === "jango_household"
                ? `가족 플러스 · ${monetization.access.remaining}회 남았어요`
                : monetization.access.tier === "jango_plus"
                  ? `장고 플러스 · ${monetization.access.remaining}회 남았어요`
                : monetization.access.rewardedAdsEnabled
                  ? `광고 추천권 ${monetization.access.rewardedAds.creditsAvailable}회 · 오늘 광고 ${monetization.access.rewardedAds.remainingToWatch}편 남음`
                  : `임시 무료 추천 ${monetization.access.remaining}회 남았어요`}
            </Text>
            {monetization.access.tier === "free" &&
            monetization.access.contributionRewards.enabled ? (
              <Text style={styles.usageDescription}>
                바코드 추천권 {monetization.access.contributionRewards.balance}회
                {monetization.access.contributionRewards.canEarn
                  ? ` · 오늘 ${monetization.access.contributionRewards.dailyLimit - monetization.access.contributionRewards.earnedToday}회 더 적립 가능`
                  : ""}
              </Text>
            ) : null}
            {monetization.access.tier === "free" &&
            monetization.access.paidCredits.salesEnabled ? (
              <Pressable
                onPress={() => router.push("/settings/recommendation-credits")}
                accessibilityRole="button"
                accessibilityLabel="AI 추천권 충전하기"
              >
                <Text style={styles.usageCreditLink}>
                  구매 추천권 {monetization.access.paidCredits.balance}회 · 충전하기
                </Text>
              </Pressable>
            ) : monetization.access.tier === "free" &&
              monetization.access.paidCredits.balance > 0 ? (
              <Text style={styles.usageDescription}>
                보유 추천권 {monetization.access.paidCredits.balance}회 · 추천할 때 자동 사용돼요
              </Text>
            ) : null}
            {monetization.access.tier === "free" &&
            monetization.access.paidCredits.balance > 0 &&
            monetization.access.rewardedAds.canWatch ? (
              <Pressable
                onPress={() => void handleWatchRewardedAdOnly()}
                accessibilityRole="button"
                accessibilityLabel="구매 추천권을 보존하고 광고로 추천권 받기"
              >
                <Text style={styles.usageCreditLink}>
                  구매 추천권 아끼고 광고 보기
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {recipeView === "recommendations" && showValueMomentOffer ? (
        <View style={styles.valueOfferCard}>
          <View style={styles.valueOfferCopy}>
            <Text style={styles.valueOfferTitle}>
              {monetization.access?.offer.kind === "jango_household"
                ? "가족 냉장고가 함께 움직이고 있어요"
                : "냉장고 관리가 습관이 되고 있어요"}
            </Text>
            <Text style={styles.valueOfferDescription}>
              {monetization.access?.offer.kind === "jango_household"
                ? "가족이 먹고 버린 재료를 한 리포트로 보고, 모두 광고 없이 추천받을 수 있어요."
                : "최근 30일 소비·폐기 흐름을 확인하고, 광고 없이 임박 재료로 계속 골라보세요."}
            </Text>
          </View>
          <Button
            onPress={() =>
              handleMonetizationOffer(monetization.access!.offer.kind)
            }
            fullWidth
          >
            {offerLabel(monetization.access!.offer.kind)}
          </Button>
        </View>
      ) : null}
      <View style={styles.recipeViewSwitch}>
        <Pressable
          onPress={() => setRecipeView("recommendations")}
          accessibilityRole="tab"
          accessibilityState={{ selected: recipeView === "recommendations" }}
          style={({ pressed }) => [
            styles.recipeViewOption,
            recipeView === "recommendations" && styles.recipeViewOptionSelected,
            pressed && styles.recipeViewOptionPressed,
          ]}
        >
          <Sparkles
            color={
              recipeView === "recommendations" ? colors.primary : colors.subtext
            }
            size={spacing.sm}
            strokeWidth={2.4}
          />
          <Text
            style={[
              styles.recipeViewLabel,
              recipeView === "recommendations" &&
                styles.recipeViewLabelSelected,
            ]}
          >
            추천받기
          </Text>
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
            color={recipeView === "favorites" ? colors.primary : colors.subtext}
            fill={recipeView === "favorites" ? colors.primary : "none"}
            size={spacing.sm}
            strokeWidth={2.4}
          />
          <Text
            style={[
              styles.recipeViewLabel,
              recipeView === "favorites" && styles.recipeViewLabelSelected,
            ]}
          >
            즐겨찾기 {favoritesQuery.data?.length ?? 0}
          </Text>
        </Pressable>
      </View>

      {setFavoriteMutation.error ? (
        <FeedbackBanner
          showMascot={false}
          title="즐겨찾기를 바꾸지 못했어요"
          description={getErrorMessage(setFavoriteMutation.error) ?? undefined}
        />
      ) : null}

      {recipeView === "recommendations" ? (
      <View style={styles.heroCard}>
        <MascotSpeechBubble
          message={
            isGenerating
              ? "냉장고를 들여다보는 중이에요. 다른 화면을 봐도 괜찮아요."
              : justGenerated
                ? "추천이 준비됐어요. 같이 살펴볼까요?"
                : hasRecommendationResult
                  ? "이 요리들로 오늘을 채워볼까요? 조건만 바꿔도 다시 골라 드릴게요."
                  : "오늘 뭐 해먹을까요? 임박 재료를 먼저 살피고 요리를 골라 드릴게요."
          }
          mood={
            isGenerating
              ? "think"
              : justGenerated
                ? "happy"
                : hasRecommendationResult
                  ? "cooking"
                  : "speak"
          }
          size="small"
        />

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
            <Text style={styles.optionsSummaryLabel}>추천 조건</Text>
            <Text style={styles.optionsSummaryValue}>
              {servings}인 · {maxCookingMinutes}분 · {mealTypeLabel}
              {useExpiringFirst ? " · 임박 먼저" : ""}
            </Text>
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
            <Text style={styles.optionsSummaryActionLabel}>바꾸기</Text>
          </View>
        </Pressable>
      </View>
      ) : null}

      {recipeView === "recommendations" && errorMessage && !isGenerating ? (
        isQuotaError ? (
          <View style={styles.quotaCard}>
            <Text style={styles.quotaTitle}>
              {canOfferRewardedAd
                ? "광고 한 편이면 추천을 이어갈 수 있어요"
                : "오늘은 추천을 조금 쉬어갈까요?"}
            </Text>
            <MascotSpeechBubble
              message={
                canOfferRewardedAd
                  ? "아래 버튼만 누르면 광고 뒤에 추천을 바로 만들어 드릴게요."
                  : "오늘의 추천 횟수를 다 썼어요. 내일 다시 부탁해도 괜찮아요."
              }
              mood="worry"
              size="small"
            />
            {!hasActiveEntitlement && canOfferRewardedAd ? (
              <Button
                onPress={() => void handleCreateRecommendation()}
                loading={monetization.adState === "loading"}
                disabled={isAdBusy}
                fullWidth
              >
                광고 보고 추천 받을게요
              </Button>
            ) : null}
            {showPersonalizedOffer ? (
              <Button
                onPress={() =>
                  handleMonetizationOffer(monetization.access!.offer.kind)
                }
                variant={canOfferRewardedAd ? "secondary" : undefined}
                fullWidth
              >
                {offerLabel(monetization.access!.offer.kind)}
              </Button>
            ) : null}
            {!hasActiveEntitlement &&
            monetization.access?.offer.personalized &&
            monetization.access?.offer.alternatives.length ? (
              <Pressable
                onPress={() => setShowOfferAlternatives(true)}
                accessibilityRole="button"
                accessibilityLabel="다른 이용 방법 보기"
                style={({ pressed }) => [
                  styles.quotaLink,
                  pressed && styles.optionsSummaryPressed,
                ]}
              >
                <Text style={styles.quotaLinkText}>다른 방법</Text>
              </Pressable>
            ) : null}
            {!hasActiveEntitlement &&
            !monetization.access?.offer.personalized &&
            monetization.access?.paidCredits.salesEnabled ? (
              <Button
                onPress={() => router.push("/settings/recommendation-credits")}
                variant="secondary"
                fullWidth
              >
                AI 추천권 충전하기
              </Button>
            ) : null}
            {!hasActiveEntitlement &&
            !monetization.access?.offer.personalized &&
            monetization.access?.subscriptionsEnabled ? (
              <Pressable
                onPress={() => router.push("/settings/subscription")}
                accessibilityRole="button"
                accessibilityLabel="장고 플러스 살펴보기"
                style={({ pressed }) => [
                  styles.quotaLink,
                  pressed && styles.optionsSummaryPressed,
                ]}
              >
                <Text style={styles.quotaLinkText}>장고 플러스 살펴보기</Text>
              </Pressable>
            ) : null}
          </View>
        ) : isCapacityError ? (
          <View style={styles.quotaCard}>
            <Text style={styles.quotaTitle}>오늘은 추천을 조금 쉬어갈까요?</Text>
            <MascotSpeechBubble
              message={
                errorMessage.includes("너무 많")
                  ? "요청이 몰렸어요. 조금만 뒤에 다시 눌러 주세요."
                  : "지금은 추천을 잠시 멈춰 두었어요. 내일 다시 부탁해도 괜찮아요."
              }
              mood="worry"
              size="small"
            />
          </View>
        ) : (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              {isHistoryLoadError
                ? "앗, 추천을 불러오지 못했어요"
                : "앗, 추천을 만들지 못했어요"}
            </Text>
            <MascotSpeechBubble
              message={errorMessage}
              mood="worry"
              size="small"
            />
            <Pressable
              onPress={() => {
                if (isHistoryLoadError) {
                  void historyQuery.refetch();
                  return;
                }
                router.push("/register");
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isHistoryLoadError
                  ? "추천 다시 불러오기"
                  : "재료부터 넣어볼까요?"
              }
              style={({ pressed }) => [
                styles.quotaLink,
                pressed && styles.optionsSummaryPressed,
              ]}
            >
              <Text style={styles.quotaLinkText}>
                {isHistoryLoadError
                  ? "다시 불러올게요"
                  : "재료부터 넣어볼까요?"}
              </Text>
            </Pressable>
          </View>
        )
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
            latestRecommendation.recommendations.map((dish, index) => (
              <RecipeCard
                key={`${latestRecommendation.id}-${dish.title}-${index}`}
                dish={dish}
                badgeLabel={String(index + 1)}
                inventorySnapshot={latestRecommendation.inventorySnapshot}
                onOpenDetails={() =>
                  handleOpenDetails({
                    recommendationId: latestRecommendation.id,
                    dishIndex: index,
                    dish,
                    inventorySnapshot: latestRecommendation.inventorySnapshot,
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
                    inventorySnapshot: latestRecommendation.inventorySnapshot,
                    favorite,
                  })
                }
              />
            ))
          ) : (
            <EmptyState
              mood="empty"
              title="이번에는 딱 맞는 요리가 없어요"
              description="조건을 조금 바꾸거나, 재료를 더 넣은 뒤 다시 부탁해 주세요."
            />
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
          <View style={styles.historyList}>
            {previousRecommendations.map((recommendation) => (
              <Pressable
                key={recommendation.id}
                onPress={() => setHistoryRecommendation(recommendation)}
                accessibilityRole="button"
                accessibilityLabel={`${formatCreatedAt(recommendation.createdAt)} 추천 다시 볼게요`}
                accessibilityHint="그때 받아 둔 요리를 다시 열어 볼 수 있어요."
                style={({ pressed }) => [
                  styles.historyRow,
                  shouldStack && styles.historyRowStacked,
                  pressed && styles.historyRowPressed,
                ]}
              >
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>
                    {formatCreatedAt(recommendation.createdAt)} 추천
                  </Text>
                  <Text style={styles.historyDescription} numberOfLines={2}>
                    {formatHistoryPreview(recommendation)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.historyAction,
                    shouldStack && styles.historyActionStacked,
                  ]}
                >
                  다시 볼게요
                </Text>
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
          <Text style={styles.favoriteLoadingText}>
            추천을 불러오고 있어요…
          </Text>
        </View>
      ) : null}

      {recipeView === "recommendations" &&
      !isHistoryInitialLoading &&
      !latestRecommendation &&
      !isGenerating &&
      !errorMessage ? (
        <EmptyState
          mood="empty"
          title="아직 추천이 없어요"
          description="아래 버튼을 누르면 장고가 냉장고 재료로 요리를 골라줄게요."
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
              style={styles.favoriteLoading}
              accessibilityLabel="즐겨찾기를 불러오고 있어요"
            >
              <Text style={styles.favoriteLoadingText}>
                즐겨찾기를 불러오고 있어요…
              </Text>
            </View>
          ) : favoritesQuery.error ? (
            <FeedbackBanner
              showMascot={false}
              title="즐겨찾기를 불러오지 못했어요"
              description={getErrorMessage(favoritesQuery.error) ?? undefined}
              actionLabel="다시 불러오기"
              onAction={() => {
                void favoritesQuery.refetch();
              }}
            />
          ) : favoritesQuery.data?.length ? (
            favoritesQuery.data.map((favorite, favoriteIndex) => (
              <RecipeCard
                key={favorite.id}
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
            ))
          ) : (
            <EmptyState
              icon={Heart}
              title="아직 즐겨찾는 요리가 없어요"
              description="추천 요리의 하트를 누르면 이곳에 모아둘게요."
              actionLabel="추천 보러 가기"
              onAction={() => setRecipeView("recommendations")}
            />
          )}
        </RecipeSection>
      ) : null}
        </ScrollView>
      </View>

      <BottomSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        mascotMood="idle"
        title="추천 조건을 고를까요?"
        description="인원과 시간만 정해도 충분해요."
        footer={
          <Button onPress={() => setShowOptionsSheet(false)} fullWidth>
            이걸로 할게요
          </Button>
        }
      >
        <View style={styles.optionGroup}>
          <View style={styles.optionHeader}>
            <Users color={colors.subtext} size={spacing.sm} strokeWidth={2.4} />
            <Text style={styles.optionTitle}>몇 명이서 먹나요?</Text>
          </View>
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
        </View>

        <View style={styles.optionGroup}>
          <View style={styles.optionHeader}>
            <Clock3
              color={colors.subtext}
              size={spacing.sm}
              strokeWidth={2.4}
            />
            <Text style={styles.optionTitle}>얼마나 걸려도 괜찮나요?</Text>
          </View>
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
        </View>

        <View style={styles.optionGroup}>
          <Text style={styles.optionTitle}>어떤 식사인가요?</Text>
          <View style={styles.pillRow}>
            {mealTypeOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={mealType === option.value}
                onPress={() => setMealType(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.pillRow}>
          <Pill
            label="임박 재료 먼저"
            tone="warning"
            selected={useExpiringFirst}
            onPress={() => setUseExpiringFirst((value) => !value)}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showOfferAlternatives}
        onClose={() => setShowOfferAlternatives(false)}
        mascotMood="idle"
        title="다른 이용 방법"
        description="지금 사용할 수 있는 방법만 모았어요."
      >
        <View style={styles.sheetFooter}>
          {monetization.access?.offer.alternatives.map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              onPress={() => handleMonetizationOffer(kind)}
              fullWidth
            >
              {offerLabel(kind)}
            </Button>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showAiNotice}
        onClose={() => {
          setShowAiNotice(false);
          setPendingPayload(null);
        }}
        mascotMood="idle"
        title="추천에 쓸 정보를 확인할까요?"
        description="장고가 요리를 고를 때 어떤 정보가 쓰이는지 짧게 알려드릴게요."
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={() => {
                setShowAiNotice(false);
                setPendingPayload(null);
              }}
              fullWidth
            >
              다음에 할게요
            </Button>
            <Button
              onPress={handleAcceptAiNotice}
              loading={acceptAiDataNoticeMutation.isPending}
              fullWidth
            >
              동의하고 추천 받을게요
            </Button>
          </View>
        }
      >
        <Text style={styles.noticeBody}>
          요리 추천을 만들 때 재료 이름, 종류, 수량과 단위, 보관 위치, 유통기한,
          만료까지 남은 일수, 고른 조건과 저장한 알레르기·식단·조리도구 설정,
          최근 즐겨찾기·조리·관심없음 요약이 장고 서버를 거쳐 외부 요리
          도우미(OpenAI)로 전달돼요. 나온 추천과 그때의 재료 목록, 추천 행동은
          기록과 더 나은 추천을 위해 내 계정에 남겨 둬요.
        </Text>
        <Text style={styles.noticeFootnote}>
          외부 요리 도우미로 보낸 정보는 기본적으로 모델 학습에 쓰이지 않아요.
          다만 서비스 안전과 이상 이용 확인을 위해 잠깐 보관될 수 있어요.
        </Text>
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
          <View style={styles.historySheetList}>
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
          </View>
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

      <BottomSheet
        visible={Boolean(recipeDetail)}
        onClose={() => setRecipeDetail(null)}
        title={recipeDetail?.dish.title ?? "요리 자세히 보기"}
        description={
          recipeDetail
            ? formatDishMeta(recipeDetail.dish)
            : "요리 방법을 함께 살펴볼까요?"
        }
        footer={
          <Button
            icon={Utensils}
            onPress={handleStartCooking}
            disabled={!recipeDetail}
            fullWidth
          >
            이 요리로 해볼게요
          </Button>
        }
      >
        {recipeDetail ? (
          <RecipeDetailContent
            dish={recipeDetail.dish}
            inventorySnapshot={recipeDetail.inventorySnapshot}
            recommendationId={recipeDetail.recommendationId}
            dishIndex={recipeDetail.dishIndex}
          />
        ) : null}
      </BottomSheet>
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
          tone="primary"
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

function RecipeCard({
  dish,
  badgeLabel,
  inventorySnapshot,
  onOpenDetails,
  isFavorite = false,
  isFavoritePending = false,
  onToggleFavorite,
}: {
  dish: RecipeRecommendationDish;
  badgeLabel?: string;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  onOpenDetails: () => void;
  isFavorite?: boolean;
  isFavoritePending?: boolean;
  onToggleFavorite?: (favorite: boolean) => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  const highlightIngredients = getHighlightedIngredients(
    dish,
    inventorySnapshot,
  );
  const ingredientPreview = formatIngredientPreview(highlightIngredients);

  return (
    <View style={[styles.recipeCard, shouldStack && styles.recipeCardStacked]}>
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
        <View style={styles.recipeCompactTitleRow}>
          <View style={styles.recipeNumberBadge}>
            <Text style={styles.recipeNumberBadgeText}>
              {badgeLabel ?? "1"}
            </Text>
          </View>
          <Text
            style={styles.recipeTitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {dish.title}
          </Text>
        </View>

        <Text style={styles.recipeMetaLine}>
          {formatDishMeta(dish)}
        </Text>

        <Text style={styles.recipeIngredientPreview} numberOfLines={2}>
          {ingredientPreview}
        </Text>
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

function RecipeDetailContent({
  dish,
  inventorySnapshot,
  recommendationId,
  dishIndex,
}: {
  dish: RecipeRecommendationDish;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  recommendationId: string;
  dishIndex: number;
}) {
  const { shouldStack } = useResponsiveLayout();
  const usedIngredientRows = getUsedIngredientRows(dish, inventorySnapshot);

  return (
    <>
      <Text style={styles.recipeDetailSummary}>{dish.summary}</Text>

      <View style={styles.recipeBlock}>
        <Text style={styles.blockTitle}>사용할 재료</Text>
        {usedIngredientRows.length > 0 ? (
          <View style={styles.ingredientInfoList}>
            {usedIngredientRows.map((ingredient) => (
              <View
                key={ingredient.key}
                style={[
                  styles.ingredientInfoRow,
                  shouldStack && styles.ingredientInfoRowStacked,
                ]}
              >
                <View
                  style={[
                    styles.ingredientInfoCopy,
                    shouldStack && styles.ingredientInfoCopyStacked,
                  ]}
                >
                  <Text style={styles.ingredientInfoName}>
                    {ingredient.name}
                  </Text>
                  {ingredient.amountLabel ? (
                    <Text style={styles.ingredientInfoAmount}>
                      추천 {ingredient.amountLabel}
                    </Text>
                  ) : null}
                </View>
                {ingredient.daysUntilExpiry !== null ? (
                  <View
                    style={[
                      styles.ingredientExpiryBadge,
                      ingredient.isExpiring
                        ? styles.ingredientExpiryBadgeExpiring
                        : styles.ingredientExpiryBadgeSafe,
                    ]}
                    accessibilityLabel={`유통기한 ${
                      formatIngredientDdayLabel(
                        ingredient.daysUntilExpiry,
                      ) ?? "임박"
                    }`}
                  >
                    <Clock3
                      color={
                        ingredient.isExpiring
                          ? colors.warning
                          : colors.success
                      }
                      size={spacing.sm}
                      strokeWidth={2.4}
                    />
                    <Text
                      style={[
                        styles.ingredientExpiryBadgeText,
                        ingredient.isExpiring
                          ? styles.ingredientExpiryBadgeTextExpiring
                          : styles.ingredientExpiryBadgeTextSafe,
                      ]}
                    >
                      {formatIngredientDdayLabel(ingredient.daysUntilExpiry) ??
                        "임박"}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.blockHint}>표시할 재료 정보가 없어요.</Text>
        )}
      </View>

      <OptionalMissingIngredientsCard
        dish={dish}
        recommendationId={recommendationId}
        dishIndex={dishIndex}
      />

      <View style={styles.recipeBlock}>
        <Text style={styles.blockTitle}>조리 순서</Text>
        <View style={styles.stepList}>
          {dish.steps.map((step, stepIndex) => (
            <View
              key={`${dish.title}-step-${stepIndex}`}
              style={styles.stepCard}
            >
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{stepIndex + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      {dish.tips.length > 0 ? (
        <View style={styles.softNoteCard}>
          <Text style={styles.softNoteTitle}>팁</Text>
          <Text style={styles.softNoteBody}>{dish.tips.join(" ")}</Text>
        </View>
      ) : null}

      {dish.safetyNote ? (
        <View style={styles.safetyCard}>
          <Text style={styles.safetyCardTitle}>안전하게 챙기기</Text>
          <Text style={styles.safetyCardBody}>{dish.safetyNote}</Text>
        </View>
      ) : null}
    </>
  );
}

function getUsedIngredientRows(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
): HighlightIngredient[] {
  const snapshotById = new Map(
    inventorySnapshot.map((item) => [item.inventoryItemId, item]),
  );

  return dish.usedIngredients.map((ingredient, index) => {
    const snapshot = ingredient.inventoryItemId
      ? snapshotById.get(ingredient.inventoryItemId)
      : undefined;
    const daysUntilExpiry = snapshot?.daysUntilExpiry ?? null;
    const isExpiring =
      typeof daysUntilExpiry === "number" &&
      daysUntilExpiry <= EXPIRING_DAYS_THRESHOLD;

    return {
      key: ingredient.inventoryItemId ?? `${ingredient.name}-${index}`,
      name: ingredient.name,
      amountLabel:
        ingredient.amount && ingredient.unitCode
          ? formatBaseQuantity(ingredient.amount, ingredient.unitCode)
          : null,
      daysUntilExpiry,
      isExpiring,
    } satisfies HighlightIngredient;
  });
}

function getHighlightedIngredients(
  dish: RecipeRecommendationDish,
  inventorySnapshot: RecipeInventorySnapshotItem[],
): HighlightIngredient[] {
  const resolved = getUsedIngredientRows(dish, inventorySnapshot);

  const expiring = resolved
    .filter((ingredient) => ingredient.isExpiring)
    .sort(
      (left, right) =>
        (left.daysUntilExpiry ?? Number.POSITIVE_INFINITY) -
        (right.daysUntilExpiry ?? Number.POSITIVE_INFINITY),
    );

  if (expiring.length > 0) {
    const nonExpiring = resolved.filter((ingredient) => !ingredient.isExpiring);
    return [...expiring, ...nonExpiring];
  }

  return resolved;
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

function formatDishMeta(dish: RecipeRecommendationDish) {
  const values = [
    `${dish.servings}인분`,
    `${dish.cookingTimeMinutes}분`,
    difficultyLabels[dish.difficulty],
  ];
  if (dish.spiceLevel) values.push(spiceLevelLabels[dish.spiceLevel]);
  if (dish.requiredEquipment?.length) {
    values.push(
      dish.requiredEquipment.map((item) => equipmentLabels[item]).join("/"),
    );
  }
  return values.join(" · ");
}

function formatIngredientPreview(ingredients: HighlightIngredient[]) {
  if (ingredients.length === 0) {
    return "재료 정보 없음";
  }

  const visibleNames = ingredients
    .slice(0, COLLAPSED_INGREDIENT_PREVIEW_COUNT)
    .map((ingredient) => ingredient.name);
  const remainingCount = ingredients.length - visibleNames.length;

  return `재료 ${visibleNames.join(" · ")}${
    remainingCount > 0 ? ` +${remainingCount}` : ""
  }`;
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

function formatIngredientDdayLabel(daysUntilExpiry: number | null) {
  if (daysUntilExpiry == null) {
    return null;
  }

  if (daysUntilExpiry < 0) {
    return `D+${Math.abs(daysUntilExpiry)}`;
  }

  if (daysUntilExpiry === 0) {
    return "오늘";
  }

  return `D-${daysUntilExpiry}`;
}

function getErrorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function offerLabel(kind: RecommendationAccess["offer"]["kind"]) {
  return resolveMonetizationOffer(kind).label;
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
    padding: spacing.md,
    gap: spacing.md,
  },
  usageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  usageCopy: {
    gap: spacing.xxs,
  },
  usageTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  usageDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  usageCreditLink: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.primary,
  },
  optionsSummary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  quotaCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  valueOfferCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  valueOfferCopy: { gap: spacing.xxs },
  valueOfferTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  valueOfferDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
  quotaTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  quotaLink: {
    alignSelf: "flex-start",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingRight: spacing.sm,
  },
  quotaLinkText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.primary,
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.danger,
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
    borderBottomWidth: 1,
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
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.mutedSurface,
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
  favoriteLoadingText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  historyList: {
    gap: spacing.xs,
  },
  historyRow: {
    minHeight: touchTarget.min,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
  historyAction: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.primary,
  },
  historyActionStacked: {
    alignSelf: "flex-end",
  },
  historySheetList: {
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
  recipeCardStacked: {
    flexDirection: "column",
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
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  recipeTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.bodyStrong.fontSize,
    lineHeight: typography.bodyStrong.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
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
  recipeMetaLine: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  recipeIngredientPreview: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  recipeDetailSummary: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  recipeBlock: {
    gap: spacing.xs,
  },
  blockTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  blockHint: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  ingredientInfoList: {
    gap: spacing.xs,
  },
  ingredientInfoRow: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ingredientInfoRowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  ingredientInfoCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ingredientInfoCopyStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  ingredientInfoName: {
    flexShrink: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  ingredientInfoAmount: {
    flexShrink: 0,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  ingredientExpiryBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  ingredientExpiryBadgeSafe: {
    backgroundColor: colors.successSoft,
  },
  ingredientExpiryBadgeExpiring: {
    backgroundColor: colors.warningSoft,
  },
  ingredientExpiryBadgeText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  ingredientExpiryBadgeTextSafe: {
    color: colors.success,
  },
  ingredientExpiryBadgeTextExpiring: {
    color: colors.warning,
  },
  softNoteCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  softNoteTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  softNoteBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  stepList: {
    gap: spacing.sm,
  },
  stepCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.surface,
  },
  stepText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  safetyCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  safetyCardTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.warning,
  },
  safetyCardBody: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
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
  sheetFooter: {
    gap: spacing.sm,
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
