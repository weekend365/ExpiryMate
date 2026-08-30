import { useQuery } from "@tanstack/react-query";
import { getAffiliateReorderPreview } from "../../services/api";
import { sessionQueryKeys, withInventorySpace } from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";

export function useAffiliateReorderPreview() {
  const gate = useSpaceScopedQueryGate();
  const query = useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.affiliateReorderPreview,
      gate.sessionUserId,
      gate.activeSpaceId,
    ),
    queryFn: () => {
      if (!gate.activeSpaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return getAffiliateReorderPreview(gate.activeSpaceId);
    },
    enabled: gate.enabled,
    staleTime: 10 * 60_000,
  });
  return useSpaceScopedQueryResult(query, gate);
}
