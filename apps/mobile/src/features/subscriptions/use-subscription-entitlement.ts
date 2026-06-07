import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubscriptionVerificationRequest } from "@expirymate/shared";
import {
  getSubscriptionEntitlement,
  verifySubscription,
} from "../../services/api";

export const subscriptionEntitlementQueryKey = ["subscription-entitlement"];

export const useSubscriptionEntitlement = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: subscriptionEntitlementQueryKey,
    queryFn: getSubscriptionEntitlement,
  });
  const verifyMutation = useMutation({
    mutationFn: (payload: SubscriptionVerificationRequest) =>
      verifySubscription(payload),
    onSuccess: (response) => {
      queryClient.setQueryData(
        subscriptionEntitlementQueryKey,
        response.entitlement,
      );
    },
  });

  return {
    query,
    verifyMutation,
  };
};
