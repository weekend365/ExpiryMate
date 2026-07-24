import type {
  RecipeFavorite,
  RecipeInventorySnapshotItem,
  RecipeRecommendationDish,
} from "@expirymate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
  withSessionUser,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";
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
  const { activeSpaceId, isReady } = useActiveSpace();

  return useQuery({
    queryKey: withInventorySpace(
      recipeRecommendationsQueryKey,
      sessionUserId,
      activeSpaceId,
    ),
    queryFn: () => listRecipeRecommendations(activeSpaceId),
    enabled: Boolean(sessionUserId && activeSpaceId && isReady),
  });
};

export const useCreateRecipeRecommendation = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();

  return useMutation({
    mutationFn: (payload: RecipeRecommendationPayload) =>
      createRecipeRecommendation(payload, activeSpaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          recipeRecommendationsQueryKey,
          sessionUserId,
          activeSpaceId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.dashboard,
          sessionUserId,
          activeSpaceId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.inventory,
          sessionUserId,
          activeSpaceId,
        ),
      });
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
  const { activeSpaceId } = useActiveSpace();
  const queryKey = withSessionUser(recipeFavoritesQueryKey, sessionUserId);

  return useMutation({
    mutationFn: async ({
      recommendationId,
      dishIndex,
      favorite,
    }: SetRecipeFavoriteVariables) =>
      favorite
        ? saveRecipeFavorite(recommendationId, dishIndex, activeSpaceId)
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
