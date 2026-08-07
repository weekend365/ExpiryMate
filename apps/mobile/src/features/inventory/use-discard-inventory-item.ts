import { useMutation, useQueryClient } from "@tanstack/react-query";
import { discardInventoryItem } from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

export const useDiscardInventoryItem = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId } = useActiveSpace();

  return useMutation({
    mutationFn: (id: string) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return discardInventoryItem(id, activeSpaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.inventory,
          sessionUserId,
          activeSpaceId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.dashboard,
          sessionUserId,
          activeSpaceId,
        ),
      });
    },
  });
};
