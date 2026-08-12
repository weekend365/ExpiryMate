import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionVerificationRequest } from "@expirymate/shared";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import {
  getSubscriptionEntitlement,
  verifySubscription,
} from "../../services/api";
import { useActiveSpace } from "../spaces/space-provider";

export const subscriptionEntitlementQueryKey = sessionQueryKeys.subscription;

export const useSubscriptionEntitlement = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();
  const queryKey = withSessionUser(
    [...subscriptionEntitlementQueryKey, activeSpaceId ?? "no-space"],
    sessionUserId,
  );
  const monetizationQueryKey = withSessionUser(
    sessionQueryKeys.monetization,
    sessionUserId,
  );

  const query = useQuery({
    queryKey,
    queryFn: () => getSubscriptionEntitlement(activeSpaceId),
    enabled: Boolean(sessionUserId && activeSpaceId && isReady),
  });
  const verifyMutation = useMutation({
    mutationFn: (payload: SubscriptionVerificationRequest) =>
      verifySubscription(payload),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response.entitlement);
      void queryClient
        .invalidateQueries({ queryKey: monetizationQueryKey })
        .catch(() => undefined);
    },
  });

  return {
    query,
    verifyMutation,
  };
};
