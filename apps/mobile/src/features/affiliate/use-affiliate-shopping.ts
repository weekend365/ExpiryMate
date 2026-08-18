import { useQuery } from "@tanstack/react-query";
import { getAffiliateShopping } from "../../services/api";
import { withInventorySpace } from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";

export const affiliateShoppingQueryKey = ["affiliate-shopping"] as const;

export function useAffiliateShopping() {
  const gate = useSpaceScopedQueryGate();
  const query = useQuery({
    queryKey: withInventorySpace(
      affiliateShoppingQueryKey,
      gate.sessionUserId,
      gate.activeSpaceId,
    ),
    queryFn: () => {
      if (!gate.activeSpaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return getAffiliateShopping(gate.activeSpaceId);
    },
    enabled: gate.enabled,
    staleTime: 5 * 60_000,
  });
  return useSpaceScopedQueryResult(query, gate);
}
