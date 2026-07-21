import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import {
  createRecipeRecommendation,
  listRecipeRecommendations,
  type RecipeRecommendationPayload,
} from "../../services/api";

export const recipeRecommendationsQueryKey = sessionQueryKeys.recipes;

export const useRecipeRecommendations = () => {
  const { sessionUserId } = useAuth();

  return useQuery({
    queryKey: withSessionUser(recipeRecommendationsQueryKey, sessionUserId),
    queryFn: listRecipeRecommendations,
    enabled: Boolean(sessionUserId),
  });
};

export const useCreateRecipeRecommendation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RecipeRecommendationPayload) =>
      createRecipeRecommendation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recipeRecommendationsQueryKey,
      });
      queryClient.invalidateQueries({ queryKey: sessionQueryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: sessionQueryKeys.inventory });
    },
  });
};
