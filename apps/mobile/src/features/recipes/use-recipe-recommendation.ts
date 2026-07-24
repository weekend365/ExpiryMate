import { useQuery } from "@tanstack/react-query";
import { getRecipeRecommendation } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import { withSessionUser } from "../auth/session-boundary";

export const recipeRecommendationQueryKey = (id: string) =>
  ["recipe-recommendation", id] as const;

export const useRecipeRecommendation = (id: string | undefined) => {
  const { sessionUserId } = useAuth();

  return useQuery({
    queryKey: withSessionUser(
      recipeRecommendationQueryKey(id ?? ""),
      sessionUserId,
    ),
    queryFn: () => getRecipeRecommendation(id as string),
    enabled: Boolean(id && sessionUserId),
  });
};
