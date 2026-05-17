import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchDiscardInventoryItems } from "../../services/api";

export const useBatchDiscardInventoryItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchDiscardInventoryItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
};
