import { useQuery } from "@tanstack/react-query";
import { getRecipeRecommendation } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import { withInventorySpace } from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

export const recipeRecommendationQueryKey = ["recipe-recommendation"] as const;

export const useRecipeRecommendation = (id: string | undefined) => {
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();

  return useQuery({
    queryKey: [
      ...withInventorySpace(
        recipeRecommendationQueryKey,
        sessionUserId,
        activeSpaceId,
      ),
      id ?? "",
    ],
    queryFn: () => getRecipeRecommendation(id as string, activeSpaceId),
    enabled: Boolean(id && sessionUserId && activeSpaceId && isReady),
  });
};
