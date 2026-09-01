import {
  ItemStatus,
  ProductCategory,
  toKstDateOnly,
  UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS,
  type InventoryItem,
  type RecommendationAccess,
  type RecipeInventorySnapshotItem,
  type RecipeMealType,
  type RecipeRecommendation,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import { router, useFocusEffect } from "expo-router";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Coffee,
  Cookie,
  Heart,
  Moon,
  PackageCheck,
  PenLine,
  RotateCcw,
  Search,
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
import { AppTextInput } from "../../src/components/AppTextInput";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { JangoHeroNoticeCarousel } from "../../src/components/JangoHeroNoticeCarousel";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SpaceSwitcher } from "../../src/components/SpaceSwitcher";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import {
  REWARDED_AD_CTA_LABEL,
  resolveMonetizationOffer,
} from "../../src/features/monetization/monetization-offer";
import {
  canContinueWithRewardedAd,
  needsRewardedAdToRecommend,
  recommendationCtaQuotaLabel,
} from "../../src/features/monetization/recommendation-access";
import {
  getRecommendationHeroStatus,
  selectRecommendationHeroIngredientNames,
} from "../../src/features/recipes/recommendation-hero";
import { getRecommendationErrorMessage } from "../../src/features/recipes/recommendation-errors";
import {
  RecommendationOfferAlternativesSheet,
  RecommendationQuotaCard,
  RecommendationValueOfferCard,
} from "../../src/features/recipes/recommendation-quota-panel";
import {
  EXPIRING_DAYS_THRESHOLD,
  formatCompactDishMeta,
  getRecipeCardSignals,
  type RecipeDetailSelection,
} from "../../src/features/recipes/recipe-detail";
import { RecipeDetailSheet } from "../../src/features/recipes/recipe-detail-sheet";
import {
  filterRecommendationIngredientItems,
  getExpiringRecommendationIngredientIds,
  type RecommendationIngredientFilter,
} from "../../src/features/recipes/recommendation-ingredient-selection";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { useRecommendationGenerateFlow } from "../../src/features/recipes/use-recommendation-generate-flow";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { useRecipePreferences } from "../../src/features/settings/use-recipe-preferences";
import {
  consumeRecipePreferenceSavedFromRecommendations,
  recipePreferenceRoute,
} from "../../src/features/settings/recipe-preference-navigation";
import { resolveRecipePreferenceSummary } from "../../src/features/settings/recipe-preference-display";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { useRegistrationStore } from "../../src/store/registration-store";
import { isInventoryPhotoParseEnabled } from "../../src/features/photo-intake/photo-parse-enabled";
import { photoParseRoute } from "../../src/features/registration/registration-return";
import { IngredientEntryMethodSheet } from "../../src/features/registration/ingredient-entry-method-sheet";
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
  controlSize,
  typography,
} from "../../src/shared/theme";
import {
  getContentMaxWidth,
  useResponsiveLayout,
} from "../../src/shared/responsive-layout";

const servingOptions = [1, 2, 3, 4];
const timeOptions = [15, 30, 60];
const PREVIOUS_RECOMMENDATION_LIMIT = 5;
const MAX_SELECTED_RECIPE_INGREDIENTS = 30;
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

const ingredientFilterOptions: Array<{
  value: RecommendationIngredientFilter;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "expiring", label: "임박 재료만" },
  { value: "fridge", label: "냉장" },
  { value: "freezer", label: "냉동" },
];

const nonRecipeCategories = new Set<ProductCategory>([
  ProductCategory.PERSONAL_CARE,
  ProductCategory.PAPER_GOODS,
  ProductCategory.CLEANING,
  ProductCategory.HOUSEHOLD,
]);

function isRecipeCandidateInventoryItem(item: InventoryItem) {
  return (
    item.status === ItemStatus.ACTIVE &&
    item.quantityBase > 0 &&
    (!item.expiryDate || item.expiryDate >= toKstDateOnly(new Date())) &&
    (!item.category || !nonRecipeCategories.has(item.category))
  );
}

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
  const [showIngredientSheet, setShowIngredientSheet] = useState(false);
  const [selectedInventoryItemIds, setSelectedInventoryItemIds] = useState<
    string[] | null
  >(null);
  const [ingredientSelectionDraft, setIngredientSelectionDraft] = useState<
    string[]
  >([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState("");
  const [ingredientSelectionFilter, setIngredientSelectionFilter] =
    useState<RecommendationIngredientFilter>("all");
  const [returnToOptionsAfterIngredientSelection, setReturnToOptionsAfterIngredientSelection] =
    useState(false);
  const [showPreferenceSavedNotice, setShowPreferenceSavedNotice] =
    useState(false);
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
    () => (inventoryQuery.data ?? []).some(isRecipeCandidateInventoryItem),
    [inventoryQuery.data],
  );
  const inventoryReady =
    inventoryQuery.isSuccess || Boolean(inventoryQuery.isError);
  const needsIngredients = inventoryReady && !hasRecommendableInventory;
  const selectableInventoryItems = useMemo(
    () =>
      (inventoryQuery.data ?? [])
        .filter(isRecipeCandidateInventoryItem)
        .sort((left, right) => {
          if (!left.expiryDate) return 1;
          if (!right.expiryDate) return -1;
          return left.expiryDate.localeCompare(right.expiryDate);
        })
        .slice(0, MAX_SELECTED_RECIPE_INGREDIENTS),
    [inventoryQuery.data],
  );
  const filteredSelectableInventoryItems = useMemo(
    () =>
      filterRecommendationIngredientItems(selectableInventoryItems, {
        filter: ingredientSelectionFilter,
        query: ingredientSearchQuery,
      }),
    [
      ingredientSearchQuery,
      ingredientSelectionFilter,
      selectableInventoryItems,
    ],
  );
  const expiringSelectableInventoryItemIds = useMemo(
    () => getExpiringRecommendationIngredientIds(selectableInventoryItems),
    [selectableInventoryItems],
  );
  const hasSafetyPreferences = Boolean(
    recipePreferencesQuery.data &&
      (recipePreferencesQuery.data.allergens.length > 0 ||
        recipePreferencesQuery.data.excludedIngredients.length > 0 ||
        recipePreferencesQuery.data.dietaryStyle !== "any"),
  );
  const recommendationHeroIngredientNames = useMemo(
    () => {
      if (
        !useExpiringFirst ||
        !recipePreferencesQuery.isSuccess ||
        hasSafetyPreferences
      ) {
        return [];
      }

      return selectRecommendationHeroIngredientNames(
        (inventoryQuery.data ?? []).filter(isRecipeCandidateInventoryItem),
      );
    },
    [
      hasSafetyPreferences,
      inventoryQuery.data,
      recipePreferencesQuery.isSuccess,
      useExpiringFirst,
    ],
  );
  const isGenerating = generationStatus === "pending";
  const buildRecommendationPayload = useCallback(
    () => ({
      servings,
      maxCookingMinutes,
      mealType,
      useExpiringFirst,
      selectedInventoryItemIds: selectedInventoryItemIds ?? undefined,
    }),
    [
      maxCookingMinutes,
      mealType,
      selectedInventoryItemIds,
      servings,
      useExpiringFirst,
    ],
  );

  useEffect(() => {
    if (!selectedInventoryItemIds) return;
    const availableIds = new Set(selectableInventoryItems.map((item) => item.id));
    const nextIds = selectedInventoryItemIds.filter((id) => availableIds.has(id));
    if (nextIds.length === selectedInventoryItemIds.length) return;
    setSelectedInventoryItemIds(nextIds.length > 0 ? nextIds : null);
  }, [selectableInventoryItems, selectedInventoryItemIds]);
  const {
    showAiNotice,
    closeAiNotice,
    handleCreateRecommendation,
    handleAcceptAiNotice,
    isAcceptingAiNotice,
  } = useRecommendationGenerateFlow({
    inventoryReady,
    needsIngredients,
    isGenerating,
    buildPayload: buildRecommendationPayload,
    onNeedsIngredients: () => setEntryMethodVisible(true),
  });

  useFocusEffect(
    useCallback(() => {
      if (consumeRecipePreferenceSavedFromRecommendations()) {
        setShowPreferenceSavedNotice(true);
      }
      return undefined;
    }, []),
  );

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
  const errorMessage = generationErrorMessage;
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
    return resolveRecipePreferenceSummary({
      preference: recipePreferencesQuery.data,
      isError: recipePreferencesQuery.isError,
      isLoading: recipePreferencesQuery.isLoading,
    });
  }, [
    recipePreferencesQuery.data,
    recipePreferencesQuery.isError,
    recipePreferencesQuery.isLoading,
  ]);
  const ingredientSelectionSummary = useMemo(() => {
    if (!selectedInventoryItemIds) {
      return `자동 선택 · 최대 ${selectableInventoryItems.length}개 재료에서 선별`;
    }
    const selectedIds = new Set(selectedInventoryItemIds);
    const names = selectableInventoryItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.displayName);
    const preview = names.slice(0, 2).join(" · ");
    return names.length > 2 ? `${preview} 외 ${names.length - 2}개` : preview;
  }, [selectableInventoryItems, selectedInventoryItemIds]);
  const recommendationSetupSummary = `${
    selectedInventoryItemIds
      ? `재료 ${selectedInventoryItemIds.length}개 선택`
      : "재료 자동"
  } · ${servings}인 · ${maxCookingMinutes}분 · ${mealTypeLabel}${
    useExpiringFirst ? " · 임박 먼저" : ""
  }`;
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
        useExpiringFirst,
        hasSafetyPreferences,
        needsIngredients,
        ingredientNames: recommendationHeroIngredientNames,
      }),
    };

    if (monetization.rewardNotice === "verified") {
      notices.push({
        id: "ad-reward",
        mood: "happy" as const,
        message: "광고 추천권이 준비됐어요",
        supportingMessage: "다음 추천을 만들 때 바로 사용할 수 있어요.",
        onPress: monetization.dismissRewardNotice,
        accessibilityHint: "알겠어요",
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
    hasSafetyPreferences,
    isCapacityError,
    isGenerating,
    isQuotaError,
    justGenerated,
    needsIngredients,
    recommendationHeroIngredientNames,
    useExpiringFirst,
    monetization.adState,
    monetization.dismissRewardNotice,
    monetization.rewardNotice,
  ]);
  const ctaQuotaLabel = monetization.access
    ? recommendationCtaQuotaLabel(monetization.access)
    : null;
  const personalizedOffer = monetization.access?.offer;
  const showPersonalizedOffer =
    !hasActiveEntitlement &&
    Boolean(personalizedOffer?.personalized) &&
    personalizedOffer?.kind !== "none" &&
    personalizedOffer?.kind !== "rewarded_ad";
  const isAdBusy = monetization.adState === "loading";
  const primaryCtaAction = "추천 받기";
  const primaryCtaLabel = isGenerating
    ? "요리 조합을 찾는 중이에요"
    : monetization.adState === "loading"
      ? "광고를 불러오는 중이에요"
      : needsIngredients
        ? "재료 추가"
        : needsRewardedAd
          ? REWARDED_AD_CTA_LABEL
          : ctaQuotaLabel
            ? `${primaryCtaAction} · ${ctaQuotaLabel}`
            : primaryCtaAction;
  const regenerateCtaLabel = needsRewardedAd
    ? "광고 보고 다시 추천받기"
    : ctaQuotaLabel
      ? `다시 추천받기 · ${ctaQuotaLabel}`
      : "다시 추천받기";

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

  const handleOpenIngredientSelection = useCallback((fromOptionsSheet = false) => {
    setIngredientSelectionDraft(
      selectedInventoryItemIds ?? selectableInventoryItems.map((item) => item.id),
    );
    setIngredientSearchQuery("");
    setIngredientSelectionFilter("all");
    setReturnToOptionsAfterIngredientSelection(fromOptionsSheet);
    if (fromOptionsSheet) {
      setShowOptionsSheet(false);
      setTimeout(() => setShowIngredientSheet(true), SHEET_TRANSITION_DELAY_MS);
      return;
    }
    setShowIngredientSheet(true);
  }, [selectableInventoryItems, selectedInventoryItemIds]);

  const handleCloseIngredientSelection = useCallback(() => {
    setShowIngredientSheet(false);
    if (!returnToOptionsAfterIngredientSelection) return;
    setReturnToOptionsAfterIngredientSelection(false);
    setTimeout(() => setShowOptionsSheet(true), SHEET_TRANSITION_DELAY_MS);
  }, [returnToOptionsAfterIngredientSelection]);

  const handleToggleIngredient = useCallback((inventoryItemId: string) => {
    setIngredientSelectionDraft((current) =>
      current.includes(inventoryItemId)
        ? current.filter((id) => id !== inventoryItemId)
        : [...current, inventoryItemId],
    );
  }, []);

  const handleApplyIngredientSelection = useCallback(() => {
    if (ingredientSelectionDraft.length === 0) return;
    setSelectedInventoryItemIds(ingredientSelectionDraft);
    handleCloseIngredientSelection();
  }, [handleCloseIngredientSelection, ingredientSelectionDraft]);

  const handleResetIngredientSelection = useCallback(() => {
    setSelectedInventoryItemIds(null);
    handleCloseIngredientSelection();
  }, [handleCloseIngredientSelection]);

  const handleSelectAllIngredients = useCallback(() => {
    setIngredientSelectionDraft(selectableInventoryItems.map((item) => item.id));
  }, [selectableInventoryItems]);

  const handleSelectExpiringIngredients = useCallback(() => {
    setIngredientSelectionDraft(expiringSelectableInventoryItemIds);
    setIngredientSelectionFilter("expiring");
  }, [expiringSelectableInventoryItemIds]);

  const handlePrimaryCta = useCallback(() => {
    if (isGenerating || isAdBusy || !inventoryReady) {
      return;
    }

    if (needsIngredients) {
      setShowPreferenceSavedNotice(false);
      setEntryMethodVisible(true);
      return;
    }

    setShowPreferenceSavedNotice(false);
    void handleCreateRecommendation();
  }, [
    handleCreateRecommendation,
    inventoryReady,
    isAdBusy,
    isGenerating,
    needsIngredients,
  ]);

  const handleOpenRecipePreferences = useCallback(
    (fromOptionsSheet = false) => {
      const openSettings = () =>
        router.push(recipePreferenceRoute("recommendations"));

      if (!fromOptionsSheet) {
        openSettings();
        return;
      }

      setShowOptionsSheet(false);
      setTimeout(openSettings, SHEET_TRANSITION_DELAY_MS);
    },
    [],
  );

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

  const handleOpenShopping = (query?: string) => {
    setRecipeDetail(null);
    router.push(
      query
        ? {
            pathname: "/(tabs)/shop",
            params: { q: query, source: "recipe_optional_entry" },
          }
        : "/(tabs)/shop",
    );
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
            추천 보기
          </Button>
        ) : hasRecommendationResult ? null : (
          <Button
            icon={needsIngredients ? PenLine : Sparkles}
            onPress={handlePrimaryCta}
            loading={isGenerating || monetization.adState === "loading"}
            disabled={isGenerating || isAdBusy || !inventoryReady}
            fullWidth
            variant="primary"
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
              tintColor={colors.brandAccent}
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
          {recipeView === "recommendations" && showPreferenceSavedNotice ? (
            <FeedbackBanner
              tone="success"
              title="새 맞춤 설정을 적용했어요"
              description="이번 추천 조건은 그대로예요. 아래 버튼을 눌러 추천을 시작할 수 있어요."
              actionLabel="닫기"
              onAction={() => setShowPreferenceSavedNotice(false)}
            />
          ) : null}
          {recipeView === "favorites" &&
          monetization.rewardNotice === "verified" ? (
            <FeedbackBanner
              tone="success"
              title="광고 추천권이 준비됐어요"
              description="다음 추천을 만들 때 바로 사용할 수 있어요."
              actionLabel="닫기"
              onAction={monetization.dismissRewardNotice}
            />
          ) : recipeView === "favorites" &&
            monetization.adState === "verifying" ? (
            <FeedbackBanner
              tone="info"
              title="광고 보상을 확인하고 있어요"
              description="확인되면 추천권에 바로 넣을게요. 남은 광고가 있으면 지금 이어서 볼 수 있어요."
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
                    ? colors.primaryForeground
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
                  recipeView === "favorites" ? colors.primaryForeground : colors.subtext
                }
                fill={recipeView === "favorites" ? colors.primaryForeground : "none"}
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
              title="즐겨찾기를 바꾸지 못했어요"
              description={
                getRecommendationErrorMessage(setFavoriteMutation.error) ?? undefined
              }
            />
          ) : null}

          {recipeView === "recommendations" && historyQuery.isError ? (
            <FeedbackBanner
              title="이전 추천을 불러오지 못했어요"
              description={historyErrorMessage ?? undefined}
              actionLabel="다시 시도"
              onAction={() => {
                void historyQuery.refetch();
              }}
            />
          ) : null}

          {recipeView === "recommendations" ? (
            <View style={styles.heroCard}>
              <JangoHeroNoticeCarousel notices={recommendationHeroNotices} />

              <View style={styles.optionsSummaryGroup}>
                <RecommendationSetupSummaryRow
                  testID="recommendation-options-button"
                  title="이번 추천 설정"
                  value={recommendationSetupSummary}
                  scope="눌러서 재료·인원·시간·끼니를 바꿀 수 있어요"
                  badgeLabel={
                    hasSafetyPreferences ? "안전 맞춤 설정 적용 중" : undefined
                  }
                  actionLabel="설정"
                  actionIcon={SlidersHorizontal}
                  onPress={() => setShowOptionsSheet(true)}
                  accessibilityLabel="이번 추천 설정 열기"
                  accessibilityHint="재료, 인원, 시간, 끼니와 항상 적용할 맞춤 설정을 확인할 수 있어요."
                />
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
                <View>
                  <RecipeCardGrid embedded>
                    {latestRecommendation.recommendations.map((dish, index) => (
                      <RecipeCard
                        key={`${latestRecommendation.id}-${dish.title}-${index}`}
                        embedded
                        showDivider={
                          index < latestRecommendation.recommendations.length - 1
                        }
                        dish={dish}
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
                  <View style={styles.regenerateAction}>
                    <Button
                      icon={RotateCcw}
                      variant="surface"
                      onPress={handlePrimaryCta}
                      disabled={isAdBusy}
                      loading={monetization.adState === "loading"}
                      fullWidth
                    >
                      {regenerateCtaLabel}
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.recipeSectionInset}>
                  <EmptyState
                    variant="plain"
                    kind="no-results"
                    mood="empty"
                    title="이번에는 딱 맞는 요리가 없어요"
                    description="조건을 조금 바꾸거나, 재료를 더 넣은 뒤 다시 부탁해 주세요."
                  />
                </View>
              )}
            </RecipeSection>
          ) : null}

          {recipeView === "recommendations" && showValueMomentOffer ? (
            <RecommendationValueOfferCard
              offerKind={monetization.access!.offer.kind}
              onSelect={handleMonetizationOffer}
            />
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
                    accessibilityLabel={`${formatCreatedAt(recommendation.createdAt)} 추천 다시 보기`}
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
                        numberOfLines={shouldStack ? undefined : 1}
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
                        color={colors.primaryForeground}
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
                    title="즐겨찾기를 불러오지 못했어요"
                    description={
                      getRecommendationErrorMessage(favoritesQuery.error) ?? undefined
                    }
                    actionLabel="다시 시도"
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
                      inventorySnapshot={favorite.inventorySnapshot}
                      onOpenDetails={() =>
                        handleOpenDetails({
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
                    kind="empty"
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

      <IngredientEntryMethodSheet
        visible={entryMethodVisible}
        onClose={() => setEntryMethodVisible(false)}
        onScan={() => {
          setEntryMethodVisible(false);
          if (activeSpaceId) clearPrefill(activeSpaceId);
          router.push("/scanner");
        }}
        onPhoto={
          isInventoryPhotoParseEnabled()
            ? () => {
                setEntryMethodVisible(false);
                if (activeSpaceId) clearPrefill(activeSpaceId);
                router.push(photoParseRoute("home"));
              }
            : undefined
        }
        onManual={() => {
          setEntryMethodVisible(false);
          if (activeSpaceId) clearPrefill(activeSpaceId);
          router.push("/register");
        }}
      />

      <BottomSheet
        visible={showIngredientSheet}
        onClose={handleCloseIngredientSelection}
        mascotMood="idle"
        title="추천에 사용할 재료"
        description={`이번 추천에 반영할 재료를 골라 주세요. 최대 ${MAX_SELECTED_RECIPE_INGREDIENTS}개까지 사용할 수 있어요.`}
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={handleResetIngredientSelection}
              fullWidth
            >
              자동 선택
            </Button>
            <Button
              onPress={handleApplyIngredientSelection}
              disabled={ingredientSelectionDraft.length === 0}
              fullWidth
            >
              선택한 재료 {ingredientSelectionDraft.length}개 적용
            </Button>
          </View>
        }
      >
        <View style={styles.ingredientSelectionList}>
          <View style={styles.ingredientSelectionToolbar}>
            <View style={styles.ingredientSearchField}>
              <Search
                color={colors.subtext}
                size={spacing.md}
                strokeWidth={2.2}
              />
              <AppTextInput
                value={ingredientSearchQuery}
                onChangeText={setIngredientSearchQuery}
                placeholder="재료 이름 검색"
                accessibilityLabel="추천 재료 검색"
                returnKeyType="search"
                style={styles.ingredientSearchInput}
              />
            </View>

            <View style={styles.ingredientFilterRow}>
              {ingredientFilterOptions.map((option) => (
                <Pill
                  key={option.value}
                  label={option.label}
                  selected={ingredientSelectionFilter === option.value}
                  onPress={() => setIngredientSelectionFilter(option.value)}
                />
              ))}
            </View>

            <View style={styles.ingredientBulkHeader}>
              <AppText style={styles.ingredientSelectionCount}>
                선택 {ingredientSelectionDraft.length}/
                {selectableInventoryItems.length}
              </AppText>
              <View style={styles.ingredientBulkActions}>
                <Pressable
                  onPress={handleSelectExpiringIngredients}
                  disabled={expiringSelectableInventoryItemIds.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="임박 재료만 선택"
                  style={({ pressed }) => [
                    styles.ingredientBulkAction,
                    pressed && styles.optionsSummaryPressed,
                    expiringSelectableInventoryItemIds.length === 0 &&
                      styles.ingredientBulkActionDisabled,
                  ]}
                >
                  <AppText style={styles.ingredientBulkActionText}>
                    임박만 선택
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={handleSelectAllIngredients}
                  accessibilityRole="button"
                  accessibilityLabel="추천 재료 전체 선택"
                  style={({ pressed }) => [
                    styles.ingredientBulkAction,
                    pressed && styles.optionsSummaryPressed,
                  ]}
                >
                  <AppText style={styles.ingredientBulkActionText}>
                    전체 선택
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => setIngredientSelectionDraft([])}
                  accessibilityRole="button"
                  accessibilityLabel="추천 재료 전체 선택 해제"
                  style={({ pressed }) => [
                    styles.ingredientBulkAction,
                    pressed && styles.optionsSummaryPressed,
                  ]}
                >
                  <AppText style={styles.ingredientBulkActionText}>
                    전체 해제
                  </AppText>
                </Pressable>
              </View>
            </View>
          </View>

          {filteredSelectableInventoryItems.map((item) => {
            const selected = ingredientSelectionDraft.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => handleToggleIngredient(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${item.displayName} 추천 재료 ${
                  selected ? "선택됨" : "선택 안 됨"
                }`}
                style={({ pressed }) => [
                  styles.ingredientSelectionRow,
                  selected && styles.ingredientSelectionRowSelected,
                  pressed && styles.optionsSummaryPressed,
                ]}
              >
                <View style={styles.ingredientSelectionCopy}>
                  <AppText style={styles.ingredientSelectionName}>
                    {item.displayName}
                  </AppText>
                  <AppText style={styles.ingredientSelectionMeta}>
                    {formatInventorySelectionMeta(item.expiryDate)}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.ingredientSelectionCheck,
                    selected && styles.ingredientSelectionCheckSelected,
                  ]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {selected ? (
                    <Check
                      color={colors.actionPrimaryForeground}
                      size={spacing.sm}
                      strokeWidth={3}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          {filteredSelectableInventoryItems.length === 0 ? (
            <EmptyState
              variant="plain"
              kind="no-results"
              title="조건에 맞는 재료가 없어요"
              description="검색어를 지우거나 다른 보관 위치를 골라 보세요."
            />
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        mascotMood="idle"
        title="오늘은 어떤 요리로 할까요?"
        description="인원·시간·끼니는 이번 추천에만 적용돼요."
        footer={
          <Button onPress={() => setShowOptionsSheet(false)} fullWidth>
            적용
          </Button>
        }
      >
        <RecommendationSetupSummaryRow
          testID="recommendation-options-ingredient-link"
          title="추천에 사용할 재료"
          value={ingredientSelectionSummary}
          scope={
            selectedInventoryItemIds
              ? "고른 재료만 이번 추천에 사용해요"
              : "임박도와 최근 사용 이력을 보고 자동으로 골라요"
          }
          actionLabel="재료 고르기"
          actionIcon={PackageCheck}
          onPress={() => handleOpenIngredientSelection(true)}
          accessibilityLabel="추천에 사용할 재료 고르기"
          accessibilityHint="이 설정 화면을 닫고 추천에 포함할 보관 재료를 고릅니다."
        />

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

        <RecommendationSetupSummaryRow
          testID="recommendation-options-preference-link"
          title="항상 적용할 맞춤 설정"
          value={preferenceSummary.text}
          scope="저장 후 모든 추천에 적용돼요"
          actionLabel="전체 설정 보기"
          actionIcon={ShieldCheck}
          onPress={() => handleOpenRecipePreferences(true)}
          accessibilityLabel="항상 적용할 추천 맞춤 설정 보기"
          accessibilityHint="이 바텀시트를 닫고 알레르기, 식단, 매운맛과 조리도구 설정 화면을 엽니다."
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
              나중에
            </Button>
            <Button
              onPress={handleAcceptAiNotice}
              loading={isAcceptingAiNotice}
              fullWidth
            >
              동의하고 추천받기
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
          즐겨찾기하지 않은 추천 기록은 최대{" "}
          {UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS}일 뒤 자동으로 지워져요.{" "}
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
            닫기
          </Button>
        }
      >
        {historyRecommendation?.recommendations.length ? (
          <RecipeCardGrid>
            {historyRecommendation.recommendations.map((dish, index) => (
              <RecipeCard
                key={`${historyRecommendation.id}-${dish.title}-${index}`}
                dish={dish}
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
            kind="no-results"
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
            collapsed ? `${title} 펼치기` : `${title} 접기`
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

function RecommendationSetupSummaryRow({
  testID,
  title,
  value,
  scope,
  badgeLabel,
  actionLabel,
  actionIcon: ActionIcon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  testID?: string;
  title: string;
  value: string;
  scope: string;
  badgeLabel?: string;
  actionLabel: string;
  actionIcon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
}) {
  const { shouldStack } = useResponsiveLayout();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.optionsSummary,
        shouldStack && styles.optionsSummaryStacked,
        pressed && styles.optionsSummaryPressed,
      ]}
    >
      <View style={styles.optionsSummaryCopy}>
        <AppText style={styles.optionsSummaryLabel}>{title}</AppText>
        <AppText
          style={styles.optionsSummaryValue}
          numberOfLines={shouldStack ? undefined : 1}
        >
          {value}
        </AppText>
        <AppText style={styles.optionsSummaryScope}>{scope}</AppText>
        {badgeLabel ? (
          <View style={styles.optionsSummarySafetyBadge}>
            <ShieldCheck
              color={colors.successForeground}
              size={spacing.sm}
              strokeWidth={2.4}
            />
            <AppText style={styles.optionsSummarySafetyBadgeText}>
              {badgeLabel}
            </AppText>
          </View>
        ) : null}
      </View>
      <View
        style={[
          styles.optionsSummaryAction,
          shouldStack && styles.optionsSummaryActionStacked,
        ]}
      >
        <ActionIcon
          color={colors.primaryForeground}
          size={spacing.sm + spacing.xxs}
          strokeWidth={2.4}
        />
        <AppText style={styles.optionsSummaryActionLabel}>{actionLabel}</AppText>
        <ChevronRight
          color={colors.primaryForeground}
          size={spacing.sm}
          strokeWidth={2.4}
        />
      </View>
    </Pressable>
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
        accessibilityLabel="임박 재료 우선 사용"
        accessibilityHint="켜 두면 유통기한이 가까운 재료로 요리를 먼저 골라 드려요."
        style={({ pressed }) => [
          styles.expiringToggleMain,
          pressed && !selected && styles.expiringTogglePressed,
        ]}
      >
        <Timer
          color={selected ? colors.warningForeground : colors.subtext}
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
          thumbColor={selected ? colors.actionWarningBackground : colors.mutedSurface}
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
  inventorySnapshot,
  onOpenDetails,
  isFavorite = false,
  isFavoritePending = false,
  onToggleFavorite,
  embedded = false,
  showDivider = false,
}: {
  dish: RecipeRecommendationDish;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  onOpenDetails: () => void;
  isFavorite?: boolean;
  isFavoritePending?: boolean;
  onToggleFavorite?: (favorite: boolean) => void;
  embedded?: boolean;
  showDivider?: boolean;
}) {
  const { isRegular } = useResponsiveLayout();
  const decisionSignals = getRecipeCardSignals(dish, inventorySnapshot);
  const decisionReason = decisionSignals
    .map((signal) => signal.label)
    .join(" · ");
  const decisionReasonTone =
    decisionSignals[0]?.tone === "warning"
      ? "warning"
      : decisionSignals[0]?.tone === "success"
        ? "success"
        : decisionSignals[0]?.tone === "primary"
          ? "primary"
          : "subtext";
  const compactMeta = formatCompactDishMeta(dish);

  return (
    <View
      style={[
        styles.recipeCard,
        !embedded && isRegular && styles.recipeCardRegular,
        embedded && styles.recipeCardEmbedded,
        showDivider && styles.recipeCardDivider,
      ]}
    >
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`${dish.title}, ${dish.summary}, ${compactMeta}, ${decisionReason}, 레시피 상세 보기`}
        accessibilityHint="사용할 재료와 조리 순서를 확인합니다."
        style={({ pressed }) => [
          styles.recipeCardMain,
          pressed && styles.recipeCardMainPressed,
        ]}
      >
        <View style={styles.recipeCardContent}>
          <View
            style={[
              styles.recipeIntro,
              onToggleFavorite && styles.recipeIntroWithFavorite,
            ]}
          >
            <AppText
              variant="bodyStrong"
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.recipeTitle}
            >
              {dish.title}
            </AppText>
            <AppText
              variant="caption"
              tone="subtext"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {dish.summary}
            </AppText>
          </View>

          <View style={styles.recipeMetaRow}>
            <AppText
              variant="caption"
              tone="subtext"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.recipeMeta}
            >
              {compactMeta}
            </AppText>
          </View>

          <AppText
            variant="caption"
            tone={decisionReasonTone}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.recipeReason}
          >
            {decisionReason}
          </AppText>
        </View>
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
            isFavorite && styles.favoriteButtonSelected,
            pressed && styles.favoriteButtonPressed,
            isFavoritePending && styles.favoriteButtonPending,
          ]}
        >
          <Heart
            color={isFavorite ? colors.primaryForeground : colors.subtext}
            fill={isFavorite ? colors.primaryForeground : "none"}
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
    (item) =>
      item.daysUntilExpiry !== null &&
      item.daysUntilExpiry <= EXPIRING_DAYS_THRESHOLD,
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

function formatInventorySelectionMeta(expiryDate: string | null) {
  if (!expiryDate) return "유통기한 미등록";
  return `${new Date(`${expiryDate}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  })}까지`;
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
    opacity: 0.16,
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
    minHeight: controlSize.minimum,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    padding: spacing.xxs,
    flexDirection: "row",
    gap: spacing.xxs,
  },
  recipeViewOption: {
    flex: 1,
    minHeight: controlSize.minimum,
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
    color: colors.primaryForeground,
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
    minHeight: controlSize.minimum,
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
  optionsSummaryScope: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  optionsSummarySafetyBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  optionsSummarySafetyBadgeText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.successForeground,
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
    color: colors.primaryForeground,
  },
  recipeSection: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  recipeSectionHeader: {
    minHeight: controlSize.minimum,
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
    minWidth: controlSize.minimum,
    minHeight: controlSize.minimum,
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
  regenerateAction: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.sm,
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
    minHeight: controlSize.minimum,
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
    minHeight: controlSize.minimum * 2,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
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
  recipeCardRegular: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
  },
  recipeCardMain: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recipeCardMainPressed: {
    backgroundColor: colors.surfacePressed,
  },
  recipeCardContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: spacing.xxs,
  },
  recipeIntro: {
    minWidth: 0,
    gap: spacing.xxs,
  },
  recipeIntroWithFavorite: {
    paddingRight: controlSize.icon + spacing.xs,
  },
  recipeTitle: {
    minWidth: 0,
  },
  recipeMetaRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  recipeMeta: {
    flex: 1,
    minWidth: 0,
  },
  recipeReason: {
    minWidth: 0,
  },
  favoriteButton: {
    position: "absolute",
    top: spacing.xxs,
    right: spacing.xs,
    zIndex: 1,
    width: controlSize.icon,
    height: controlSize.icon,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
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
  ingredientSelectionList: {
    gap: spacing.xs,
  },
  ingredientSelectionToolbar: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  ingredientSearchField: {
    minHeight: controlSize.minimum,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ingredientSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: controlSize.minimum,
    paddingVertical: spacing.xs,
  },
  ingredientFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  ingredientBulkHeader: {
    gap: spacing.xs,
  },
  ingredientSelectionCount: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  ingredientBulkActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  ingredientBulkAction: {
    minHeight: controlSize.minimum,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
  },
  ingredientBulkActionDisabled: {
    opacity: 0.45,
  },
  ingredientBulkActionText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primaryForeground,
  },
  ingredientSelectionRow: {
    minHeight: controlSize.minimum,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ingredientSelectionRowSelected: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
  },
  ingredientSelectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  ingredientSelectionName: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  ingredientSelectionMeta: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  ingredientSelectionCheck: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientSelectionCheckSelected: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.actionPrimaryBackground,
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
    minHeight: controlSize.minimum,
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
