import { useQuery } from "@tanstack/react-query";
import { getRecipeRecommendation } from "../../services/api";
import { withInventorySpace } from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";

export const recipeRecommendationQueryKey = ["recipe-recommendation"] as const;

export const useRecipeRecommendation = (id: string | undefined) => {
  const {
    sessionUserId,
    activeSpaceId,
    enabled,
    isAwaitingSpace,
    blockingSpaceError,
    refetchSpaces,
  } = useSpaceScopedQueryGate();

  const query = useQuery({
    queryKey: [
      ...withInventorySpace(
        recipeRecommendationQueryKey,
        sessionUserId,
        activeSpaceId,
      ),
      id ?? "",
    ],
    queryFn: () => getRecipeRecommendation(id as string, activeSpaceId),
    enabled: Boolean(id && enabled),
  });

  return {
    ...query,
    error: blockingSpaceError ?? query.error,
    isError: Boolean(blockingSpaceError) || query.isError,
    isLoading:
      Boolean(id) &&
      !blockingSpaceError &&
      (isAwaitingSpace || query.isLoading),
    isPending:
      Boolean(id) &&
      !blockingSpaceError &&
      (isAwaitingSpace || query.isPending),
    refetch: blockingSpaceError ? refetchSpaces : query.refetch,
  };
};
