import type {
  RecipeFavorite,
  RecipeEngagementAction,
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
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";
import {
  deleteRecipeFavorite,
  listRecipeFavorites,
  listRecipeRecommendations,
  saveRecipeFavorite,
  updateRecipeEngagement,
} from "../../services/api";

export const recipeRecommendationsQueryKey = sessionQueryKeys.recipes;
export const recipeFavoritesQueryKey = sessionQueryKeys.recipeFavorites;

export const getRecipeFavoriteKey = (
  recommendationId: string,
  dishIndex: number,
) => `${recommendationId}:${dishIndex}`;

export const useRecipeRecommendations = () => {
  const gate = useSpaceScopedQueryGate();

  const query = useQuery({
    queryKey: withInventorySpace(
      recipeRecommendationsQueryKey,
      gate.sessionUserId,
      gate.activeSpaceId,
    ),
    queryFn: () => {
      if (!gate.activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return listRecipeRecommendations(gate.activeSpaceId);
    },
    enabled: gate.enabled,
    refetchOnMount: "always",
  });

  return useSpaceScopedQueryResult(query, gate);
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
    }: SetRecipeFavoriteVariables) => {
      if (favorite) {
        if (!activeSpaceId) {
          throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
        }
        return saveRecipeFavorite(recommendationId, dishIndex, activeSpaceId);
      }
      return deleteRecipeFavorite(recommendationId, dishIndex, activeSpaceId);
    },
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

export const useRecipeEngagement = () => {
  const { activeSpaceId } = useActiveSpace();

  return useMutation({
    mutationFn: ({
      recommendationId,
      dishIndex,
      action,
    }: {
      recommendationId: string;
      dishIndex: number;
      action: RecipeEngagementAction;
    }) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return updateRecipeEngagement(
        recommendationId,
        dishIndex,
        action,
        activeSpaceId,
      );
    },
  });
};
