import type { InsightWindowDays } from "@expirymate/shared";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { withSessionUser } from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";
import { getInsightsOverview, getInsightsPreview } from "../../services/api";

export function useInsightsPreview() {
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();
  return useQuery({
    queryKey: withSessionUser(
      ["insights", "preview", activeSpaceId ?? "no-space"],
      sessionUserId,
    ),
    queryFn: () => getInsightsPreview(activeSpaceId!),
    enabled: Boolean(sessionUserId && activeSpaceId && isReady),
  });
}

export function useInsightsOverview(
  windowDays: InsightWindowDays,
  enabled: boolean,
) {
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();
  return useQuery({
    queryKey: withSessionUser(
      ["insights", "overview", activeSpaceId ?? "no-space", String(windowDays)],
      sessionUserId,
    ),
    queryFn: () => getInsightsOverview(activeSpaceId!, windowDays),
    enabled: Boolean(enabled && sessionUserId && activeSpaceId && isReady),
  });
}
