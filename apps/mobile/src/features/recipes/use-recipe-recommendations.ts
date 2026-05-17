import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRecipeRecommendation,
  listRecipeRecommendations,
  type RecipeRecommendationPayload,
} from "../../services/api";

export const recipeRecommendationsQueryKey = ["recipe-recommendations"];

export const useRecipeRecommendations = () =>
  useQuery({
    queryKey: recipeRecommendationsQueryKey,
    queryFn: listRecipeRecommendations,
  });

export const useCreateRecipeRecommendation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RecipeRecommendationPayload) =>
      createRecipeRecommendation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: recipeRecommendationsQueryKey,
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
    },
  });
};
