import type { InventoryItem } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchDiscardInventoryItems } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import { useActiveSpace } from "../spaces/space-provider";
import { inventoryRemovalQueryKeys } from "./deferred-inventory-removal";

export const useBatchDiscardInventoryItems = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const keys = inventoryRemovalQueryKeys(sessionUserId, activeSpaceId);

  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return batchDiscardInventoryItems(ids, activeSpaceId);
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: keys.inventory });
      const previous = queryClient.getQueryData<InventoryItem[]>(keys.inventory);
      const idSet = new Set(ids);

      queryClient.setQueryData<InventoryItem[]>(keys.inventory, (current) =>
        (current ?? []).filter((item) => !idSet.has(item.id)),
      );

      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.inventory, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.inventory });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.shopping });
    },
  });
};
