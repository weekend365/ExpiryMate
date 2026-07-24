import type {
  RecipeFavorite,
  RecipeInventorySnapshotItem,
  RecipeRecommendationDish,
} from "@expirymate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import {
  createRecipeRecommendation,
  deleteRecipeFavorite,
  listRecipeFavorites,
  listRecipeRecommendations,
  saveRecipeFavorite,
  type RecipeRecommendationPayload,
} from "../../services/api";

export const recipeRecommendationsQueryKey = sessionQueryKeys.recipes;
export const recipeFavoritesQueryKey = sessionQueryKeys.recipeFavorites;

export const getRecipeFavoriteKey = (
  recommendationId: string,
  dishIndex: number,
) => `${recommendationId}:${dishIndex}`;

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

export const useRecipeFavorites = () => {
  const { sessionUserId } = useAuth();

  return useQuery({
    queryKey: withSessionUser(recipeFavoritesQueryKey, sessionUserId),
    queryFn: listRecipeFavorites,
    enabled: Boolean(sessionUserId),
  });
};

type SetRecipeFavoriteVariables = {
  recommendationId: string;
  dishIndex: number;
  dish: RecipeRecommendationDish;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  favorite: boolean;
};

export const useSetRecipeFavorite = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(recipeFavoritesQueryKey, sessionUserId);

  return useMutation({
    mutationFn: async ({
      recommendationId,
      dishIndex,
      favorite,
    }: SetRecipeFavoriteVariables) =>
      favorite
        ? saveRecipeFavorite(recommendationId, dishIndex)
        : deleteRecipeFavorite(recommendationId, dishIndex),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RecipeFavorite[]>(queryKey);
      const targetKey = getRecipeFavoriteKey(
        variables.recommendationId,
        variables.dishIndex,
      );

      queryClient.setQueryData<RecipeFavorite[]>(queryKey, (current = []) => {
        if (!variables.favorite) {
          return current.filter(
            (item) =>
              getRecipeFavoriteKey(
                item.sourceRecommendationId,
                item.sourceDishIndex,
              ) !== targetKey,
          );
        }

        const alreadySaved = current.some(
          (item) =>
            getRecipeFavoriteKey(
              item.sourceRecommendationId,
              item.sourceDishIndex,
            ) === targetKey,
        );

        if (alreadySaved) {
          return current;
        }

        return [
          {
            id: `optimistic:${targetKey}`,
            ownerKey: sessionUserId ?? "",
            sourceRecommendationId: variables.recommendationId,
            sourceDishIndex: variables.dishIndex,
            dish: variables.dish,
            inventorySnapshot: variables.inventorySnapshot,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ];
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSuccess: (response, variables) => {
      if (!variables.favorite || !("id" in response)) {
        return;
      }

      const targetKey = getRecipeFavoriteKey(
        variables.recommendationId,
        variables.dishIndex,
      );
      queryClient.setQueryData<RecipeFavorite[]>(queryKey, (current = []) =>
        current.map((item) =>
          getRecipeFavoriteKey(
            item.sourceRecommendationId,
            item.sourceDishIndex,
          ) === targetKey
            ? response
            : item,
        ),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
};
