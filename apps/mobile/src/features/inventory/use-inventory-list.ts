import { useQuery } from "@tanstack/react-query";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { listAllInventory } from "../../services/api";

export const useInventoryList = () => {
  const { sessionUserId, activeSpaceId, enabled, isAwaitingSpace } =
    useSpaceScopedQueryGate();

  const query = useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.inventory,
      sessionUserId,
      activeSpaceId,
    ),
    queryFn: () => listAllInventory(activeSpaceId),
    enabled,
  });

  return {
    ...query,
    isLoading: isAwaitingSpace || query.isLoading,
    isPending: isAwaitingSpace || query.isPending,
  };
};
