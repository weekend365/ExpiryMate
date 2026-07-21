import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import { getDashboardSummary } from "../../services/api";

export const useDashboardSummary = () => {
  const { sessionUserId } = useAuth();

  return useQuery({
    queryKey: withSessionUser(sessionQueryKeys.dashboard, sessionUserId),
    queryFn: getDashboardSummary,
    enabled: Boolean(sessionUserId),
  });
};
