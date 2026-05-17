import { useMutation, useQueryClient } from "@tanstack/react-query";
import { discardInventoryItem } from "../../services/api";

export const useDiscardInventoryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: discardInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
};
