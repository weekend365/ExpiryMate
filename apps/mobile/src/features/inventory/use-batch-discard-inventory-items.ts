import type { InventoryItem } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchDiscardInventoryItems } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

export const useBatchDiscardInventoryItems = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();
  const inventoryKey = withInventorySpace(
    sessionQueryKeys.inventory,
    sessionUserId,
    activeSpaceId,
  );
  const dashboardKey = withInventorySpace(
    sessionQueryKeys.dashboard,
    sessionUserId,
    activeSpaceId,
  );

  return useMutation({
    mutationFn: (ids: string[]) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return batchDiscardInventoryItems(ids, activeSpaceId);
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: inventoryKey });
      const previous = queryClient.getQueryData<InventoryItem[]>(inventoryKey);
      const idSet = new Set(ids);

      queryClient.setQueryData<InventoryItem[]>(inventoryKey, (current) =>
        (current ?? []).filter((item) => !idSet.has(item.id)),
      );

      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(inventoryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
    },
  });
};
