import { useQuery } from "@tanstack/react-query";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { listAllInventory } from "../../services/api";

export const useInventoryList = () => {
  const {
    sessionUserId,
    activeSpaceId,
    enabled,
    isAwaitingSpace,
    blockingSpaceError,
    refetchSpaces,
  } = useSpaceScopedQueryGate();

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
    error: blockingSpaceError ?? query.error,
    isError: Boolean(blockingSpaceError) || query.isError,
    isLoading:
      !blockingSpaceError && (isAwaitingSpace || query.isLoading),
    isPending:
      !blockingSpaceError && (isAwaitingSpace || query.isPending),
    refetch: blockingSpaceError ? refetchSpaces : query.refetch,
  };
};
