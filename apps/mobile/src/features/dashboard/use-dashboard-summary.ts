import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";
import { getDashboardSummary } from "../../services/api";

export const useDashboardSummary = () => {
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();

  return useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.dashboard,
      sessionUserId,
      activeSpaceId,
    ),
    queryFn: () => getDashboardSummary(activeSpaceId),
    enabled: Boolean(sessionUserId && activeSpaceId && isReady),
  });
};
