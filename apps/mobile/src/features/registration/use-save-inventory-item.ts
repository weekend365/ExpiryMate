import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createInventoryItem } from "../../services/api";
import { useActiveSpace } from "../spaces/space-provider";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";

export const useSaveInventoryItem = () => {
  const queryClient = useQueryClient();
  const { activeSpaceId } = useActiveSpace();
  const { sessionUserId } = useAuth();

  return useMutation({
    mutationFn: (payload: Parameters<typeof createInventoryItem>[0]) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return createInventoryItem(payload, activeSpaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.dashboard,
          sessionUserId,
          activeSpaceId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.inventory,
          sessionUserId,
          activeSpaceId,
        ),
      });
    },
  });
};
