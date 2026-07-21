import type {
  RecipeMealType,
  RecipeRecommendationDish,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  Clock3,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
} from "../../src/features/privacy/use-privacy";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { useRecipeRecommendations } from "../../src/features/recipes/use-recipe-recommendations";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import type { RecipeRecommendationPayload } from "../../src/services/api";
import { colors, radius, spacing, touchTarget, typography } from "../../src/shared/theme";

const servingOptions = [1, 2, 3, 4];
const timeOptions = [15, 30, 60];

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

const difficultyLabels: Record<RecipeRecommendationDish["difficulty"], string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export default function RecommendationsScreen() {
  const params = useLocalSearchParams<{ autoGenerateAt?: string }>();
  const historyQuery = useRecipeRecommendations();
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
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<RecipeRecommendationPayload | null>(null);
  const handledAutoGenerateRef = useRef<string | null>(null);
  const isGenerating = generationStatus === "pending";

  const latestRecommendation = useMemo(
    () => latestGeneratedRecommendation ?? historyQuery.data?.[0] ?? null,
    [historyQuery.data, latestGeneratedRecommendation],
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
      title="오늘 뭐 먹지?"
      subtitle="장고가 냉장고 재료로 만들기 쉬운 요리를 골라줄게요."
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={historyQuery.isRefetching}
          onRefresh={historyQuery.refetch}
        />
      }
      footer={
        <Button
          icon={Sparkles}
          onPress={handleCreateRecommendation}
          loading={isGenerating}
          disabled={isGenerating}
          fullWidth
        >
          {isGenerating ? "요리 조합을 찾는 중이에요" : "추천 받을게요"}
        </Button>
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>장고의 요리 추천</Text>
            <Text style={styles.heroTitle}>
              {isGenerating
                ? "냉장고를 들여다보는 중이에요"
                : justGenerated
                  ? "추천이 준비됐어요"
                  : "오늘 뭐 해먹을까요?"}
            </Text>
            <Text style={styles.heroDescription}>
              {isGenerating
                ? "다른 화면을 봐도 괜찮아요. 끝나면 알려드릴게요."
                : "임박한 재료를 먼저 살피고, 부족한 재료는 있으면 좋은 재료로만 알려줘요."}
            </Text>
          </View>
          <Mascot
            size="medium"
            mood={justGenerated ? "happy" : "cooking"}
            style={styles.heroMascot}
          />
        </View>
      </View>

      <Pressable
        onPress={() => setShowOptionsSheet(true)}
        style={({ pressed }) => [
          styles.optionsSummary,
          pressed && styles.optionsSummaryPressed,
        ]}
      >
        <View style={styles.optionsSummaryCopy}>
          <Text style={styles.optionsSummaryLabel}>추천 조건</Text>
          <Text style={styles.optionsSummaryValue}>
            {servings}인 · {maxCookingMinutes}분 · {mealTypeLabel}
            {useExpiringFirst ? " · 임박 재료 먼저" : ""}
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

      {errorMessage && !isGenerating ? (
        isQuotaError ? (
          <View style={styles.quotaCard}>
            <Mascot size="small" mood={hasActiveEntitlement ? "idle" : "worry"} />
            <View style={styles.quotaCopy}>
              <Text style={styles.quotaTitle}>오늘은 추천을 조금 쉬어갈까요?</Text>
              <Text style={styles.quotaDescription}>
                {errorMessage.includes("너무 많")
                  ? "요청이 몰렸어요. 조금만 뒤에 다시 눌러 주세요."
                  : "오늘의 추천 횟수를 다 썼어요. 내일 다시 부탁해도 괜찮아요."}
              </Text>
              {!hasActiveEntitlement ? (
                <Pressable
                  onPress={() => router.push("/(tabs)/settings")}
                  style={({ pressed }) => [
                    styles.quotaLink,
                    pressed && styles.optionsSummaryPressed,
                  ]}
                >
                  <Text style={styles.quotaLinkText}>구독 안내 보러 가기</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.errorCard}>
            <Mascot size="small" mood="worry" />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>앗, 추천을 만들지 못했어요</Text>
              <Text style={styles.errorDescription}>{errorMessage}</Text>
              <Pressable
                onPress={() => router.push("/register")}
                style={({ pressed }) => [
                  styles.quotaLink,
                  pressed && styles.optionsSummaryPressed,
                ]}
              >
                <Text style={styles.quotaLinkText}>재료부터 넣어볼까요?</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : null}

      {latestRecommendation && !isGenerating ? (
        <View style={styles.resultSection}>
          <SectionHeader
            title="이번에 골라본 요리"
            description={`${formatCreatedAt(latestRecommendation.createdAt)} · 보관 재료 ${latestRecommendation.inventorySnapshot.length}개 기준`}
          />

          {latestRecommendation.recommendations.length ? (
            latestRecommendation.recommendations.map((dish, index) => (
              <RecipeCard key={`${dish.title}-${index}`} dish={dish} index={index} />
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

      {!latestRecommendation && !isGenerating && !errorMessage ? (
        <EmptyState
          mood="empty"
          title="아직 추천이 없어요"
          description="아래 버튼을 누르면 장고가 냉장고 재료로 요리를 골라줄게요."
        />
      ) : null}

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
            <Clock3 color={colors.subtext} size={spacing.sm} strokeWidth={2.4} />
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
          요리 추천을 만들 때 재료명, 카테고리, 수량과 단위, 보관 위치,
          유통기한, 만료까지 남은 일수, 추천 조건이 서버를 통해 OpenAI API로
          전송돼요. 추천 결과와 입력 snapshot은 히스토리와 품질 개선을
          위해 내 계정에 남겨 둬요.
        </Text>
        <Text style={styles.noticeFootnote}>
          OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않지만, 서비스
          보안과 abuse monitoring을 위해 일정 기간 보관될 수 있어요.
        </Text>
      </BottomSheet>
    </Screen>
  );
}

function RecipeCard({
  dish,
  index,
}: {
  dish: RecipeRecommendationDish;
  index: number;
}) {
  return (
    <View style={styles.recipeCard}>
      <View style={styles.recipeHeader}>
        <View style={styles.recipeBadge}>
          <Text style={styles.recipeBadgeText}>{index + 1}</Text>
        </View>
        <View style={styles.recipeTitleGroup}>
          <Text style={styles.recipeTitle}>{dish.title}</Text>
          <Text style={styles.recipeMeta}>
            {dish.cookingTimeMinutes}분 · {difficultyLabels[dish.difficulty]} ·{" "}
            {dish.servings}인분
          </Text>
        </View>
      </View>
      <Text style={styles.recipeSummary}>{dish.summary}</Text>

      <View style={styles.recipeBlock}>
        <Text style={styles.blockTitle}>사용할 재료</Text>
        <Text style={styles.blockText}>
          {dish.usedIngredients.map((ingredient) => ingredient.name).join(", ")}
        </Text>
      </View>

      {dish.optionalMissingIngredients.length ? (
        <View style={styles.recipeBlock}>
          <Text style={styles.blockTitle}>있으면 좋은 재료</Text>
          <Text style={styles.blockText}>
            {dish.optionalMissingIngredients
              .map((ingredient) => `${ingredient.name} (${ingredient.reason})`)
              .join(", ")}
          </Text>
        </View>
      ) : null}

      <View style={styles.recipeBlock}>
        <Text style={styles.blockTitle}>조리 순서</Text>
        <View style={styles.stepList}>
          {dish.steps.map((step, stepIndex) => (
            <View key={`${dish.title}-step-${stepIndex}`} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{stepIndex + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      {dish.tips.length ? (
        <View style={styles.recipeBlock}>
          <Text style={styles.blockTitle}>팁</Text>
          <Text style={styles.blockText}>{dish.tips.join(" ")}</Text>
        </View>
      ) : null}

      <Text style={styles.safetyNote}>{dish.safetyNote}</Text>
    </View>
  );
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
  heroCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.lg,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroMascot: {
    flexShrink: 0,
  },
  heroEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  heroTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  heroDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  optionsSummary: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionsSummaryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  optionsSummaryCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  optionsSummaryLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  optionsSummaryValue: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  quotaCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  quotaTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  quotaDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  errorTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.danger,
  },
  errorDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  resultSection: {
    gap: spacing.sm,
  },
  recipeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  recipeHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  recipeBadge: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.sm,
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
  recipeTitleGroup: {
    flex: 1,
    gap: spacing.xxs,
  },
  recipeTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  recipeMeta: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  recipeSummary: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
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
  blockText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  stepList: {
    gap: spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stepNumber: {
    width: spacing.md,
    fontSize: typography.label.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  safetyNote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
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
