import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { RecipeRecommendation } from "@expirymate/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  createRecipeRecommendation,
  type RecipeRecommendationPayload,
} from "../../services/api";
import {
  NOTIFICATION_TYPES,
  scheduleLocalNotification,
} from "../../services/notifications";
import { recipeRecommendationsQueryKey } from "./use-recipe-recommendations";

type RecipeGenerationStatus = "idle" | "pending" | "success" | "error";

interface RecipeGenerationContextValue {
  status: RecipeGenerationStatus;
  latestGeneratedRecommendation: RecipeRecommendation | null;
  latestGeneratedRecommendationId: string | null;
  errorMessage: string | null;
  generateRecipeRecommendation: (
    payload: RecipeRecommendationPayload,
  ) => Promise<RecipeRecommendation | null>;
  resetRecipeGeneration: () => void;
}

const RecipeGenerationContext =
  createContext<RecipeGenerationContextValue | null>(null);

export function RecipeGenerationProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RecipeGenerationStatus>("idle");
  const [latestGeneratedRecommendation, setLatestGeneratedRecommendation] =
    useState<RecipeRecommendation | null>(null);
  const [latestGeneratedRecommendationId, setLatestGeneratedRecommendationId] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateRecipeRecommendation = useCallback(
    async (payload: RecipeRecommendationPayload) => {
      setStatus("pending");
      setErrorMessage(null);

      try {
        const recommendation = await createRecipeRecommendation(payload);

        setLatestGeneratedRecommendation(recommendation);
        setLatestGeneratedRecommendationId(recommendation.id);
        setStatus("success");

        queryClient.invalidateQueries({
          queryKey: recipeRecommendationsQueryKey,
        });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-list"] });

        scheduleLocalNotification(
          "요리 추천이 준비됐어요",
          "어떤 요리가 나왔는지 볼까요?",
          {
            type: NOTIFICATION_TYPES.recipeReady,
            recommendationId: recommendation.id,
          },
        ).catch(() => null);

        return recommendation;
      } catch (error) {
        setStatus("error");
        setErrorMessage(getErrorMessage(error));
        return null;
      }
    },
    [queryClient],
  );

  const resetRecipeGeneration = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const value = useMemo(
    () => ({
      status,
      latestGeneratedRecommendation,
      latestGeneratedRecommendationId,
      errorMessage,
      generateRecipeRecommendation,
      resetRecipeGeneration,
    }),
    [
      errorMessage,
      generateRecipeRecommendation,
      latestGeneratedRecommendation,
      latestGeneratedRecommendationId,
      resetRecipeGeneration,
      status,
    ],
  );

  return (
    <RecipeGenerationContext.Provider value={value}>
      {children}
    </RecipeGenerationContext.Provider>
  );
}

export function useRecipeGeneration() {
  const context = useContext(RecipeGenerationContext);

  if (!context) {
    throw new Error("useRecipeGeneration must be used within RecipeGenerationProvider");
  }

  return context;
}

function getErrorMessage(error: unknown) {
  if (!error) {
    return "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
  }

  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}
