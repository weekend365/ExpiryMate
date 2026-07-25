import { useQuery } from "@tanstack/react-query";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { getDashboardSummary } from "../../services/api";

export const useDashboardSummary = () => {
  const { sessionUserId, activeSpaceId, enabled, isAwaitingSpace } =
    useSpaceScopedQueryGate();

  const query = useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.dashboard,
      sessionUserId,
      activeSpaceId,
    ),
    queryFn: () => getDashboardSummary(activeSpaceId),
    enabled,
  });

  return {
    ...query,
    isLoading: isAwaitingSpace || query.isLoading,
    isPending: isAwaitingSpace || query.isPending,
  };
};
