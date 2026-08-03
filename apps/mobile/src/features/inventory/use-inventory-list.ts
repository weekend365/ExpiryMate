import { useQuery } from "@tanstack/react-query";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";
import { listAllInventory } from "../../services/api";

export const useInventoryList = () => {
  const gate = useSpaceScopedQueryGate();

  const query = useQuery({
    queryKey: withInventorySpace(
      sessionQueryKeys.inventory,
      gate.sessionUserId,
      gate.activeSpaceId,
    ),
    queryFn: () => listAllInventory(gate.activeSpaceId),
    enabled: gate.enabled,
    refetchOnMount: "always",
  });

  return useSpaceScopedQueryResult(query, gate);
};
