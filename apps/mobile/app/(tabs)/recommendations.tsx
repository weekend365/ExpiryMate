import type {
  RecipeMealType,
  RecipeRecommendationDish,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
} from "../../src/features/privacy/use-privacy";
import { useRecipeGeneration } from "../../src/features/recipes/recipe-generation-provider";
import { useRecipeRecommendations } from "../../src/features/recipes/use-recipe-recommendations";
import type { RecipeRecommendationPayload } from "../../src/services/api";
import { colors, spacing } from "../../src/shared/theme";

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
  const [servings, setServings] = useState(2);
  const [maxCookingMinutes, setMaxCookingMinutes] = useState(30);
  const [mealType, setMealType] = useState<RecipeMealType>("any");
  const [useExpiringFirst, setUseExpiringFirst] = useState(true);
  const [showAiNotice, setShowAiNotice] = useState(false);
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
    await generateRecipeRecommendation(pendingPayload ?? buildRecommendationPayload());
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
      subtitle="보관 중인 재료와 유통기한을 보고 만들기 쉬운 요리를 추천해요."
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          refreshing={historyQuery.isRefetching}
          onRefresh={historyQuery.refetch}
        />
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>냉장고 속 재료로 바로 만들 요리</Text>
            <Text style={styles.heroDescription}>
              임박한 재료를 먼저 살피고, 부족한 재료는 선택 재료로만 제안해요.
            </Text>
          </View>
          <Mascot size="medium" style={styles.heroMascot} />
        </View>
        <Button
          icon={Sparkles}
          onPress={handleCreateRecommendation}
          loading={isGenerating}
          disabled={isGenerating}
          fullWidth
        >
          추천 받기
        </Button>
      </View>

      {isGenerating ? (
        <View style={styles.pendingCard}>
          <Mascot size="small" style={styles.pendingMascot} />
          <View style={styles.pendingCopy}>
            <Text style={styles.pendingTitle}>요리 조합을 찾고 있어요</Text>
            <Text style={styles.pendingDescription}>
              다른 화면을 봐도 완료되면 알려드릴게요.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.optionSection}>
        <Text style={styles.sectionTitle}>추천 조건</Text>
        <View style={styles.optionGroup}>
          <View style={styles.optionHeader}>
            <Users color={colors.subtext} size={16} strokeWidth={2.4} />
            <Text style={styles.optionTitle}>인원</Text>
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
            <Clock3 color={colors.subtext} size={16} strokeWidth={2.4} />
            <Text style={styles.optionTitle}>조리 시간</Text>
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
          <Text style={styles.optionTitle}>식사 유형</Text>
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
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <AlertTriangle color={colors.danger} size={18} strokeWidth={2.5} />
          <View style={styles.errorCopy}>
            <Text style={styles.errorTitle}>추천을 만들지 못했어요</Text>
            <Text style={styles.errorDescription}>{errorMessage}</Text>
            <View style={styles.errorActions}>
              <Button
                variant="secondary"
                size="small"
                icon={Plus}
                onPress={() => router.push("/register")}
              >
                재료 등록하기
              </Button>
            </View>
          </View>
        </View>
      ) : null}

      {latestRecommendation ? (
        <View style={styles.resultSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>추천 결과</Text>
            <Text style={styles.sectionMeta}>
              {formatCreatedAt(latestRecommendation.createdAt)}
            </Text>
          </View>
          <Text style={styles.resultSummary}>
            보관 재료 {latestRecommendation.inventorySnapshot.length}개를 기준으로 추천했어요.
          </Text>
          {generationStatus === "success" &&
          latestRecommendation.id === latestGeneratedRecommendationId ? (
            <View style={styles.readyCard}>
              <Mascot size="small" style={styles.readyMascot} />
              <View style={styles.readyCopy}>
                <View style={styles.readyTitleRow}>
                  <CheckCircle2 color={colors.success} size={18} strokeWidth={2.5} />
                  <Text style={styles.readyTitle}>추천이 준비됐어요</Text>
                </View>
                <Text style={styles.readyDescription}>
                  지금 보관 중인 재료로 바로 만들기 쉬운 순서로 골랐어요.
                </Text>
              </View>
            </View>
          ) : null}
          {latestRecommendation.recommendations.map((dish, index) => (
            <RecipeCard key={`${dish.title}-${index}`} dish={dish} index={index} />
          ))}
        </View>
      ) : !isGenerating ? (
        <View style={styles.emptyCard}>
          <Mascot size="small" style={styles.emptyMascot} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>아직 추천 결과가 없어요</Text>
            <Text style={styles.emptyDescription}>
              보관 중인 재료로 오늘 만들 요리를 추천받아보세요.
            </Text>
            <Button
              variant="secondary"
              size="small"
              icon={Plus}
              onPress={() => router.push("/register")}
            >
              재료 등록하기
            </Button>
          </View>
        </View>
      ) : null}

      <AiDataNoticeModal
        visible={showAiNotice}
        loading={acceptAiDataNoticeMutation.isPending}
        onClose={() => setShowAiNotice(false)}
        onAccept={handleAcceptAiNotice}
      />
    </Screen>
  );
}

function AiDataNoticeModal({
  visible,
  loading,
  onClose,
  onAccept,
}: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onAccept: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <ShieldCheck color={colors.primary} size={24} strokeWidth={2.5} />
          </View>
          <Text style={styles.modalTitle}>AI 추천에 사용할 데이터를 확인해 주세요</Text>
          <Text style={styles.modalDescription}>
            요리 추천을 만들 때 재료명, 카테고리, 수량과 단위, 보관 위치,
            유통기한, 만료까지 남은 일수, 추천 조건이 서버를 통해 OpenAI API로
            전송돼요. 추천 결과와 입력 snapshot은 히스토리 확인과 품질 개선을
            위해 내 계정에 저장돼요.
          </Text>
          <Text style={styles.modalFootnote}>
            OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않지만, 서비스
            보안과 abuse monitoring을 위해 일정 기간 보관될 수 있어요.
          </Text>
          <View style={styles.modalActions}>
            <Button variant="secondary" onPress={onClose} style={styles.modalButton}>
              취소
            </Button>
            <Button
              onPress={onAccept}
              loading={loading}
              style={styles.modalButton}
            >
              동의하고 추천 받기
            </Button>
          </View>
        </View>
      </View>
    </Modal>
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
            {dish.cookingTimeMinutes}분 · {difficultyLabels[dish.difficulty]} · {dish.servings}인분
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

  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroHeader: {
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
  heroTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.text,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.subtext,
  },
  optionSection: {
    gap: spacing.md,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  pendingCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  pendingMascot: {
    flexShrink: 0,
  },
  pendingCopy: {
    flex: 1,
    gap: 3,
  },
  pendingTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },
  pendingDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  optionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.subtext,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  errorCopy: {
    flex: 1,
    gap: 2,
  },
  errorActions: {
    alignItems: "flex-start",
    paddingTop: spacing.xs,
  },
  errorTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.danger,
  },
  errorDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  resultSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.text,
  },
  sectionMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.mutedText,
  },
  resultSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  readyCard: {
    backgroundColor: colors.successSoft,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  readyMascot: {
    flexShrink: 0,
  },
  readyCopy: {
    flex: 1,
    gap: 4,
  },
  readyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  readyTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
  },
  readyDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  recipeCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
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
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeBadgeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.surface,
  },
  recipeTitleGroup: {
    flex: 1,
    gap: 2,
  },
  recipeTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    color: colors.text,
  },
  recipeMeta: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: colors.primary,
  },
  recipeSummary: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  recipeBlock: {
    gap: 4,
  },
  blockTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.subtext,
  },
  blockText: {
    fontSize: 14,
    lineHeight: 21,
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
    width: 22,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  safetyNote: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.mutedText,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  emptyMascot: {
    flexShrink: 0,
  },
  emptyCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.text,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(25,31,40,0.42)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.text,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  modalFootnote: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.subtext,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
