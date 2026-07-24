import {
  formatBaseQuantity,
  type RecipeInventorySnapshotItem,
  type RecipeMealType,
  type RecipeRecommendation,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock3,
  Heart,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
} from "../../src/features/privacy/use-privacy";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import {
  getRecipeFavoriteKey,
  useRecipeFavorites,
  useRecipeRecommendations,
  useSetRecipeFavorite,
} from "../../src/features/recipes/use-recipe-recommendations";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import type { RecipeRecommendationPayload } from "../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

const servingOptions = [1, 2, 3, 4];
const timeOptions = [15, 30, 60];
const HIGHLIGHT_INGREDIENT_COUNT = 3;
const COLLAPSED_HIGHLIGHT_INGREDIENT_COUNT = 2;
const EXPIRING_DAYS_THRESHOLD = 7;
const PREVIOUS_RECOMMENDATION_LIMIT = 5;
type RecipeView = "recommendations" | "favorites";

type HighlightIngredient = {
  key: string;
  name: string;
  inventoryItemId: string | null;
  amountLabel: string | null;
  daysUntilExpiry: number | null;
  isExpiring: boolean;
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

export default function RecommendationsScreen() {
  const params = useLocalSearchParams<{ autoGenerateAt?: string }>();
  const historyQuery = useRecipeRecommendations();
  const favoritesQuery = useRecipeFavorites();
  const setFavoriteMutation = useSetRecipeFavorite();
  const {
    status: generationStatus,
    latestGeneratedRecommendation,
    latestGeneratedRecommendationId,
    errorMessage: generationErrorMessage,
    generateRecipeRecommendation,
  } = useRecipeGeneration();
  const privacyStatusQuery = usePrivacyStatus();
  const acceptAiDataNoticeMutation = useAcceptAiDataNotice();
  const subscription = useSubscriptionEntitlement();
  const [servings, setServings] = useState(2);
  const [maxCookingMinutes, setMaxCookingMinutes] = useState(30);
  const [mealType, setMealType] = useState<RecipeMealType>("any");
  const [useExpiringFirst, setUseExpiringFirst] = useState(true);
  const [recipeView, setRecipeView] = useState<RecipeView>("recommendations");
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [historyRecommendation, setHistoryRecommendation] =
    useState<RecipeRecommendation | null>(null);
  const [pendingPayload, setPendingPayload] =
    useState<RecipeRecommendationPayload | null>(null);
  const handledAutoGenerateRef = useRef<string | null>(null);
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
  const errorMessage =
    generationErrorMessage ?? getErrorMessage(historyQuery.error);
  const isQuotaError = isRecommendationQuotaError(errorMessage);
  const hasActiveEntitlement = Boolean(
    subscription.query.data?.hasActiveEntitlement,
  );
  const justGenerated =
    generationStatus === "success" &&
    Boolean(latestRecommendation) &&
    latestRecommendation?.id === latestGeneratedRecommendationId;
  const mealTypeLabel =
    mealTypeOptions.find((option) => option.value === mealType)?.label ??
    "상관없음";
  const hasRecommendationResult = Boolean(
    latestRecommendation?.recommendations.length,
  );
  const primaryCtaLabel = isGenerating
    ? "요리 조합을 찾는 중이에요"
    : hasRecommendationResult
      ? "다시 골라볼게요"
      : "추천 받을게요";

  const buildRecommendationPayload = useCallback(
    (): RecipeRecommendationPayload => ({
      servings,
      maxCookingMinutes,
      mealType,
      useExpiringFirst,
    }),
    [maxCookingMinutes, mealType, servings, useExpiringFirst],
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

    await generateRecipeRecommendation(payload);
  }, [
    buildRecommendationPayload,
    generateRecipeRecommendation,
    privacyStatusQuery,
  ]);

  const handlePrimaryCta = useCallback(() => {
    if (isGenerating) {
      return;
    }

    if (!hasRecommendationResult) {
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
  }, [handleCreateRecommendation, hasRecommendationResult, isGenerating]);

  const handleAcceptAiNotice = useCallback(async () => {
    await acceptAiDataNoticeMutation.mutateAsync();
    setShowAiNotice(false);
    await generateRecipeRecommendation(
      pendingPayload ?? buildRecommendationPayload(),
    );
    setPendingPayload(null);
  }, [
    acceptAiDataNoticeMutation,
    buildRecommendationPayload,
    generateRecipeRecommendation,
    pendingPayload,
  ]);

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

  return (
    <Screen
      scroll={false}
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
            loading={isGenerating}
            disabled={isGenerating}
            fullWidth
            variant={
              hasRecommendationResult && !isGenerating ? "surface" : "primary"
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
          onPress={() => setShowOptionsSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="추천 조건 고르기"
          accessibilityHint="인원, 시간, 끼니를 바꿀 수 있어요."
          style={({ pressed }) => [
            styles.optionsSummary,
            pressed && styles.optionsSummaryPressed,
          ]}
        >
          <View style={styles.optionsSummaryCopy}>
            <Text style={styles.optionsSummaryLabel}>추천 조건</Text>
            <Text style={styles.optionsSummaryValue} numberOfLines={1}>
              {servings}인 · {maxCookingMinutes}분 · {mealTypeLabel}
              {useExpiringFirst ? " · 임박 먼저" : ""}
            </Text>
          </View>
          <View style={styles.optionsSummaryAction}>
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
              오늘은 추천을 조금 쉬어갈까요?
            </Text>
            <MascotSpeechBubble
              message={
                errorMessage.includes("너무 많")
                  ? "요청이 몰렸어요. 조금만 뒤에 다시 눌러 주세요."
                  : "오늘의 추천 횟수를 다 썼어요. 내일 다시 부탁해도 괜찮아요."
              }
              mood={hasActiveEntitlement ? "idle" : "worry"}
              size="small"
            />
            {!hasActiveEntitlement ? (
              <Pressable
                onPress={() => router.push("/(tabs)/settings")}
                accessibilityRole="button"
                accessibilityLabel="구독 안내 보러 가기"
                style={({ pressed }) => [
                  styles.quotaLink,
                  pressed && styles.optionsSummaryPressed,
                ]}
              >
                <Text style={styles.quotaLinkText}>구독 안내 보러 가기</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>앗, 추천을 만들지 못했어요</Text>
            <MascotSpeechBubble
              message={errorMessage}
              mood="worry"
              size="small"
            />
            <Pressable
              onPress={() => router.push("/register")}
              accessibilityRole="button"
              accessibilityLabel="재료부터 넣어볼까요?"
              style={({ pressed }) => [
                styles.quotaLink,
                pressed && styles.optionsSummaryPressed,
              ]}
            >
              <Text style={styles.quotaLinkText}>재료부터 넣어볼까요?</Text>
            </Pressable>
          </View>
        )
      ) : null}

      {recipeView === "recommendations" &&
      latestRecommendation &&
      !isGenerating ? (
        <View style={styles.resultSection}>
          <SectionHeader
            title="이번에 골라본 요리"
            description={formatRecommendationDescription(latestRecommendation)}
          />

          {latestRecommendation.recommendations.length ? (
            latestRecommendation.recommendations.map((dish, index) => (
              <RecipeCard
                key={`${latestRecommendation.id}-${dish.title}-${index}`}
                recommendationId={latestRecommendation.id}
                dish={dish}
                index={index}
                inventorySnapshot={latestRecommendation.inventorySnapshot}
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
        </View>
      ) : null}

      {recipeView === "recommendations" &&
      previousRecommendations.length > 0 &&
      !isGenerating ? (
        <View style={styles.resultSection}>
          <SectionHeader
            title="이전 추천"
            description="예전에 받아 둔 요리도 다시 살펴볼 수 있어요."
          />
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
                <Text style={styles.historyAction}>다시 볼게요</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {recipeView === "recommendations" &&
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
        <View style={styles.resultSection}>
          <SectionHeader
            title="즐겨찾는 요리"
            description="저장해 둔 요리를 언제든 다시 펼쳐볼 수 있어요."
          />
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
                recommendationId={favorite.sourceRecommendationId}
                dish={favorite.dish}
                index={favorite.sourceDishIndex}
                badgeLabel={String(favoriteIndex + 1)}
                inventorySnapshot={favorite.inventorySnapshot}
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
        </View>
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
          만료까지 남은 일수, 고른 조건이 장고 서버를 거쳐 외부 요리
          도우미(OpenAI)로 전달돼요. 나온 추천과 그때의 재료 목록은 기록과 더
          나은 추천을 위해 내 계정에 남겨 둬요.
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
                recommendationId={historyRecommendation.id}
                dish={dish}
                index={index}
                inventorySnapshot={historyRecommendation.inventorySnapshot}
                onStartCooking={() => setHistoryRecommendation(null)}
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
    </Screen>
  );
}

function RecipeCard({
  recommendationId,
  dish,
  index,
  badgeLabel,
  inventorySnapshot,
  onStartCooking,
  isFavorite = false,
  isFavoritePending = false,
  onToggleFavorite,
}: {
  recommendationId: string;
  dish: RecipeRecommendationDish;
  index: number;
  badgeLabel?: string;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  onStartCooking?: () => void;
  isFavorite?: boolean;
  isFavoritePending?: boolean;
  onToggleFavorite?: (favorite: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checkedIngredientKeys, setCheckedIngredientKeys] = useState<string[]>(
    [],
  );
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;
  const highlightIngredients = getHighlightedIngredients(
    dish,
    inventorySnapshot,
  );
  const visibleHighlights = expanded
    ? highlightIngredients
    : highlightIngredients.slice(0, COLLAPSED_HIGHLIGHT_INGREDIENT_COUNT);
  const usedIngredientRows = getUsedIngredientRows(dish, inventorySnapshot);
  const checkedIngredientKeySet = useMemo(
    () => new Set(checkedIngredientKeys),
    [checkedIngredientKeys],
  );
  const metaPills = [
    `${dish.cookingTimeMinutes}분`,
    difficultyLabels[dish.difficulty],
    `${dish.servings}인분`,
  ];

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setExpanded((current) => !current);
  };

  const openIngredient = (ingredient: HighlightIngredient) => {
    if (!ingredient.inventoryItemId) {
      router.push("/(tabs)/inventory");
      return;
    }

    router.push({
      pathname: "/inventory/[id]",
      params: { id: ingredient.inventoryItemId },
    });
  };

  const toggleIngredientChecked = (key: string) => {
    setCheckedIngredientKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const handleStartCooking = () => {
    onStartCooking?.();
    router.push({
      pathname: "/cooking/[recommendationId]",
      params: {
        recommendationId,
        dishIndex: String(index),
      },
    });
  };

  return (
    <View style={styles.recipeCard}>
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
            color={isFavorite ? colors.primary : colors.subtext}
            fill={isFavorite ? colors.primary : "none"}
            size={spacing.md}
            strokeWidth={2.4}
          />
        </Pressable>
      ) : null}
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`${dish.title}, ${
          expanded ? "레시피를 접어요" : "레시피를 펼쳐요"
        }`}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [
          styles.recipeSummaryPressable,
          pressed && styles.recipeSummaryPressed,
        ]}
      >
        <View style={styles.recipeHeader}>
          <View style={styles.recipeBadge}>
            <Text style={styles.recipeBadgeText}>
              {badgeLabel ?? index + 1}
            </Text>
          </View>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {dish.title}
          </Text>
          <View
            style={styles.recipeExpandAffordance}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ChevronIcon
              color={colors.primary}
              size={spacing.sm + spacing.xxs}
              strokeWidth={2.4}
            />
          </View>
        </View>

        <Text
          style={styles.recipeSummary}
          numberOfLines={expanded ? undefined : 2}
        >
          {dish.summary}
        </Text>
      </Pressable>

      <View style={styles.recipeChipRow}>
        {metaPills.map((label) => (
          <View key={label} style={styles.recipeMetaPill}>
            <Text style={styles.recipeMetaPillText}>{label}</Text>
          </View>
        ))}
        {visibleHighlights.map((ingredient) => {
          const ddayLabel = formatIngredientDdayLabel(
            ingredient.daysUntilExpiry,
          );
          const chipLabel = ddayLabel
            ? `${ingredient.name} · ${ddayLabel}`
            : ingredient.name;

          return (
            <Pressable
              key={ingredient.key}
              onPress={() => openIngredient(ingredient)}
              hitSlop={{
                top: spacing.xs,
                bottom: spacing.xs,
                left: spacing.xxs,
                right: spacing.xxs,
              }}
              accessibilityRole="button"
              accessibilityLabel={
                ingredient.isExpiring
                  ? `${chipLabel}, 유통기한 임박 재료 살펴보기`
                  : `${chipLabel} 재료 살펴보기`
              }
              style={({ pressed }) => [
                styles.ingredientChip,
                ingredient.isExpiring
                  ? styles.ingredientChipExpiring
                  : styles.ingredientChipDefault,
                pressed && styles.ingredientChipPressed,
              ]}
            >
              {ingredient.isExpiring ? (
                <Clock3
                  color={colors.warning}
                  size={spacing.sm}
                  strokeWidth={2.4}
                />
              ) : null}
              <Text
                style={[
                  styles.ingredientChipText,
                  ingredient.isExpiring
                    ? styles.ingredientChipTextExpiring
                    : styles.ingredientChipTextDefault,
                ]}
                numberOfLines={1}
              >
                {chipLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {expanded ? (
        <>
          <View style={styles.recipeBlock}>
            <Text style={styles.blockTitle}>사용할 재료</Text>
            <Text style={styles.blockHint}>
              준비된 재료는 눌러서 체크해 주세요.
            </Text>
            <View style={styles.checklist}>
              {usedIngredientRows.map((ingredient) => {
                const checked = checkedIngredientKeySet.has(ingredient.key);

                return (
                  <Pressable
                    key={ingredient.key}
                    onPress={() => toggleIngredientChecked(ingredient.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${ingredient.name}${
                      ingredient.amountLabel
                        ? ` ${ingredient.amountLabel}`
                        : ""
                    }${ingredient.isExpiring ? ", 유통기한 임박" : ""}`}
                    style={({ pressed }) => [
                      styles.checklistRow,
                      checked && styles.checklistRowChecked,
                      pressed && styles.checklistRowPressed,
                    ]}
                  >
                    {checked ? (
                      <CheckCircle2
                        color={colors.primary}
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                    ) : (
                      <Circle
                        color={colors.mutedText}
                        size={spacing.md}
                        strokeWidth={2.2}
                      />
                    )}
                    <View style={styles.checklistCopy}>
                      <Text style={styles.checklistText}>
                        {ingredient.name}
                      </Text>
                      {ingredient.amountLabel ? (
                        <Text style={styles.checklistAmount}>
                          추천 {ingredient.amountLabel}
                        </Text>
                      ) : null}
                    </View>
                    {ingredient.isExpiring ? (
                      <View style={styles.checklistBadge}>
                        <Clock3
                          color={colors.warning}
                          size={spacing.sm}
                          strokeWidth={2.4}
                        />
                        <Text style={styles.checklistBadgeText}>
                          {formatIngredientDdayLabel(
                            ingredient.daysUntilExpiry,
                          ) ?? "임박"}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {dish.optionalMissingIngredients.length ? (
            <View style={styles.softNoteCard}>
              <Text style={styles.softNoteTitle}>있으면 좋은 재료</Text>
              <Text style={styles.softNoteBody}>
                {dish.optionalMissingIngredients
                  .map(
                    (ingredient) => `${ingredient.name} (${ingredient.reason})`,
                  )
                  .join(", ")}
              </Text>
            </View>
          ) : null}

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

          {dish.tips.length ? (
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
      ) : null}

      <Button
        icon={Utensils}
        variant="secondary"
        onPress={handleStartCooking}
        fullWidth
      >
        이 요리로 해볼게요
      </Button>
    </View>
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
      inventoryItemId: ingredient.inventoryItemId,
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

  if (expiring.length) {
    return expiring.slice(0, HIGHLIGHT_INGREDIENT_COUNT);
  }

  return resolved.slice(0, HIGHLIGHT_INGREDIENT_COUNT);
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

function formatRecommendationDescription(recommendation: RecipeRecommendation) {
  return `${formatCreatedAt(recommendation.createdAt)} · ${formatRecommendationContext(recommendation)}`;
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

function isRecommendationQuotaError(message: string | null) {
  if (!message) {
    return false;
  }

  return (
    message.includes("한도") ||
    message.includes("예산") ||
    message.includes("너무 많")
  );
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
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
    fontFamily: typography.bodyStrong.fontFamily,
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
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  optionsSummaryValue: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  optionsSummaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  optionsSummaryActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  quotaCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
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
    fontFamily: typography.title.fontFamily,
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
  resultSection: {
    gap: spacing.sm,
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
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  historyList: {
    gap: spacing.sm,
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
  historyRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  historyCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  historyTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  historyDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  historyAction: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  historySheetList: {
    gap: spacing.sm,
  },
  recipeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recipeSummaryPressable: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingRight: touchTarget.icon + spacing.xs,
  },
  recipeSummaryPressed: {
    opacity: 0.85,
  },
  recipeHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  recipeBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeBadgeText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.surface,
  },
  recipeTitle: {
    flex: 1,
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  recipeExpandAffordance: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    position: "absolute",
    zIndex: 1,
    top: spacing.md,
    right: spacing.md,
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
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
  recipeSummary: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.subtext,
  },
  recipeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  recipeMetaPill: {
    minHeight: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeMetaPillText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.subtext,
  },
  ingredientChip: {
    // Compact info chip (32px); hitSlop keeps the touch target near 48px.
    minHeight: spacing.lg,
    maxWidth: "100%",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  ingredientChipDefault: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  ingredientChipExpiring: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
  },
  ingredientChipPressed: {
    opacity: 0.8,
  },
  ingredientChipText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  ingredientChipTextDefault: {
    color: colors.primary,
  },
  ingredientChipTextExpiring: {
    color: colors.warning,
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
  checklist: {
    gap: spacing.xs,
  },
  checklistRow: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checklistRowChecked: {
    backgroundColor: colors.primarySoft,
  },
  checklistRowPressed: {
    opacity: 0.85,
  },
  checklistCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  checklistText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  checklistAmount: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  checklistBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  checklistBadgeText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
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
