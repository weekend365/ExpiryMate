import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionVerificationRequest } from "@expirymate/shared";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import {
  getSubscriptionEntitlement,
  verifySubscription,
} from "../../services/api";

export const subscriptionEntitlementQueryKey = sessionQueryKeys.subscription;

export const useSubscriptionEntitlement = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(
    subscriptionEntitlementQueryKey,
    sessionUserId,
  );

  const query = useQuery({
    queryKey,
    queryFn: getSubscriptionEntitlement,
    enabled: Boolean(sessionUserId),
  });
  const verifyMutation = useMutation({
    mutationFn: (payload: SubscriptionVerificationRequest) =>
      verifySubscription(payload),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response.entitlement);
    },
  });

  return {
    query,
    verifyMutation,
  };
};
