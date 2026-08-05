import { useQuery } from "@tanstack/react-query";
import { getRecipeRecommendation } from "../../services/api";
import { withInventorySpace } from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";

export const recipeRecommendationQueryKey = ["recipe-recommendation"] as const;

export const useRecipeRecommendation = (id: string | undefined) => {
  const gate = useSpaceScopedQueryGate();
  const enabled = Boolean(id && gate.enabled);

  const query = useQuery({
    queryKey: [
      ...withInventorySpace(
        recipeRecommendationQueryKey,
        gate.sessionUserId,
        gate.activeSpaceId,
      ),
      id ?? "",
    ],
    queryFn: () => {
      if (!id || !gate.activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return getRecipeRecommendation(id, gate.activeSpaceId);
    },
    enabled,
    refetchOnMount: "always",
  });

  const result = useSpaceScopedQueryResult(query, {
    ...gate,
    enabled,
  });

  return {
    ...result,
    // Detail screens only load once an id exists; keep awaiting-space loading
    // gated the same way when the route param is present.
    isLoading: Boolean(id) && result.isLoading,
    isPending: Boolean(id) && result.isPending,
  };
};
