import type { AffiliateOffersResponse } from "@expirymate/shared";
import { useQuery } from "@tanstack/react-query";
import { getAffiliateOffers } from "../../services/api";
import { withInventorySpace } from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";

export const affiliateOffersQueryKey = ["affiliate-offers"] as const;

export const useAffiliateOffers = (
  recommendationId: string | undefined,
  dishIndex: number | undefined,
) => {
  const gate = useSpaceScopedQueryGate();
  const enabled =
    Boolean(recommendationId) &&
    typeof dishIndex === "number" &&
    Number.isInteger(dishIndex) &&
    dishIndex >= 0 &&
    gate.enabled;

  const query = useQuery({
    queryKey: [
      ...withInventorySpace(
        affiliateOffersQueryKey,
        gate.sessionUserId,
        gate.activeSpaceId,
      ),
      recommendationId ?? "",
      dishIndex ?? -1,
    ],
    queryFn: (): Promise<AffiliateOffersResponse> => {
      if (!recommendationId || dishIndex === undefined || !gate.activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return getAffiliateOffers(
        recommendationId,
        dishIndex,
        gate.activeSpaceId,
      );
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  return useSpaceScopedQueryResult(query, {
    ...gate,
    enabled,
  });
};
