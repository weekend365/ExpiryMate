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
    queryFn: () => {
      if (!gate.activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return listAllInventory(gate.activeSpaceId);
    },
    enabled: gate.enabled,
    refetchOnMount: "always",
  });

  return useSpaceScopedQueryResult(query, gate);
};
