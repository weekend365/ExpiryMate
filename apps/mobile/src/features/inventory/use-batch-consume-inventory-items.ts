import type { BatchConsumeInventoryItemsBody } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchConsumeInventoryItems } from "../../services/api";
import { sessionQueryKeys } from "../auth/session-boundary";

export const useBatchConsumeInventoryItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BatchConsumeInventoryItemsBody) =>
      batchConsumeInventoryItems(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: sessionQueryKeys.dashboard });
      result.items.forEach((item) => {
        queryClient.invalidateQueries({
          queryKey: ["inventory-item", item.id],
        });
      });
    },
  });
};
