import { useQuery } from "@tanstack/react-query";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";
import { getDashboardSummary } from "../../services/api";

export const useDashboardSummary = () => {
  const gate = useSpaceScopedQueryGate();

  const query = useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.dashboard,
      gate.sessionUserId,
      gate.activeSpaceId,
    ),
    queryFn: () => getDashboardSummary(gate.activeSpaceId),
    enabled: gate.enabled,
    refetchOnMount: "always",
  });

  return useSpaceScopedQueryResult(query, gate);
};
