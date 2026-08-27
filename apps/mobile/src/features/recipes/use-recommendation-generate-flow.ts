import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  ApiError,
  type RecipeRecommendationPayload,
} from "../../services/api";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
} from "../privacy/use-privacy";
import { useMonetization } from "../monetization/monetization-provider";
import {
  canGenerateWithoutRewardedAd,
  needsRewardedAdToRecommend,
  parseRecommendationAccess,
} from "../monetization/recommendation-access";
import { getRecommendationErrorMessage } from "./recommendation-errors";
import { useRecipeGeneration } from "./recipe-generation-provider";

export function useRecommendationGenerateFlow({
  inventoryReady,
  needsIngredients,
  isGenerating,
  buildPayload,
  onNeedsIngredients,
}: {
  inventoryReady: boolean;
  needsIngredients: boolean;
  isGenerating: boolean;
  buildPayload: () => RecipeRecommendationPayload;
  onNeedsIngredients: () => void;
}) {
  const { generateRecipeRecommendation } = useRecipeGeneration();
  const monetization = useMonetization();
  const privacyStatusQuery = usePrivacyStatus();
  const acceptAiDataNoticeMutation = useAcceptAiDataNotice();
  const params = useLocalSearchParams<{ autoGenerateAt?: string }>();
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<RecipeRecommendationPayload | null>(null);
  const handledAutoGenerateRef = useRef<string | null>(null);
  const pendingGenerateAfterRewardRef =
    useRef<RecipeRecommendationPayload | null>(null);

  const startRecommendation = useCallback(
    async (payload: RecipeRecommendationPayload) => {
      if (needsRewardedAdToRecommend(monetization.access)) {
        if (monetization.adState === "loading") {
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
          if (
            canGenerateWithoutRewardedAd(accessFromError ?? monetization.access)
          ) {
            await generateRecipeRecommendation(payload);
            return;
          }
          Alert.alert(
            "광고를 완료하지 못했어요",
            getRecommendationErrorMessage(error) ??
              "잠시 뒤에 다시 시도해 주세요.",
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
    if (!inventoryReady) {
      return;
    }

    if (needsIngredients) {
      onNeedsIngredients();
      return;
    }

    const payload = buildPayload();
    const privacyStatus =
      privacyStatusQuery.data ?? (await privacyStatusQuery.refetch()).data;

    if (!privacyStatus?.hasAcceptedCurrentAiDataNotice) {
      setPendingPayload(payload);
      setShowAiNotice(true);
      return;
    }

    await startRecommendation(payload);
  }, [
    buildPayload,
    inventoryReady,
    needsIngredients,
    onNeedsIngredients,
    privacyStatusQuery,
    startRecommendation,
  ]);

  const closeAiNotice = useCallback(() => {
    setShowAiNotice(false);
    setPendingPayload(null);
  }, []);

  const handleAcceptAiNotice = useCallback(async () => {
    const payload = pendingPayload ?? buildPayload();
    await acceptAiDataNoticeMutation.mutateAsync();
    setShowAiNotice(false);
    setPendingPayload(null);
    await startRecommendation(payload);
  }, [
    acceptAiDataNoticeMutation,
    buildPayload,
    pendingPayload,
    startRecommendation,
  ]);

  const handleWatchRewardedAdOnly = useCallback(async () => {
    if (monetization.adState === "loading") {
      return;
    }
    try {
      await monetization.watchRewardedAd();
    } catch (error) {
      Alert.alert(
        "광고를 완료하지 못했어요",
        getRecommendationErrorMessage(error) ?? "잠시 뒤에 다시 시도해 주세요.",
      );
    }
  }, [monetization]);

  useEffect(() => {
    const autoGenerateAt = Array.isArray(params.autoGenerateAt)
      ? params.autoGenerateAt[0]
      : params.autoGenerateAt;

    if (!autoGenerateAt || handledAutoGenerateRef.current === autoGenerateAt) {
      return;
    }

    if (!inventoryReady) {
      return;
    }

    handledAutoGenerateRef.current = autoGenerateAt;

    if (isGenerating || needsIngredients) {
      return;
    }

    void handleCreateRecommendation();
  }, [
    handleCreateRecommendation,
    inventoryReady,
    isGenerating,
    needsIngredients,
    params.autoGenerateAt,
  ]);

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

  return {
    showAiNotice,
    closeAiNotice,
    handleCreateRecommendation,
    handleAcceptAiNotice,
    handleWatchRewardedAdOnly,
    isAcceptingAiNotice: acceptAiDataNoticeMutation.isPending,
  };
}
