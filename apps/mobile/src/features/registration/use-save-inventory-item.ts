import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createInventoryItem } from "../../services/api";

export const useSaveInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
    },
  });
};
