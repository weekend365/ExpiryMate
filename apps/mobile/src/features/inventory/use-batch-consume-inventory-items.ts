import type { BatchConsumeInventoryItemsBody } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchConsumeInventoryItems } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

export const useBatchConsumeInventoryItems = () => {
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
    mutationFn: (payload: BatchConsumeInventoryItemsBody) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return batchConsumeInventoryItems(payload, activeSpaceId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: inventoryKey });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
      result.items.forEach((item) => {
        queryClient.invalidateQueries({
          queryKey: [
            "inventory-item",
            sessionUserId,
            activeSpaceId,
            item.id,
          ],
        });
      });
    },
  });
};
