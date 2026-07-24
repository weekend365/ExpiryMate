import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";
import { listAllInventory } from "../../services/api";

export const useInventoryList = () => {
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();

  return useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.inventory,
      sessionUserId,
      activeSpaceId,
    ),
    queryFn: () => listAllInventory(activeSpaceId),
    enabled: Boolean(sessionUserId && activeSpaceId && isReady),
  });
};
