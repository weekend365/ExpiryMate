import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InventorySpaceSummary } from "@expirymate/shared";
import { updateSpaceNotifications } from "../../services/api";
import { spacesListQueryKey } from "../auth/session-boundary";
import { useAuth } from "../auth/use-auth";
import { useActiveSpace } from "./space-provider";

export function useUpdateSpaceNotifications() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { refetchSpaces } = useActiveSpace();

  return useMutation({
    mutationFn: ({
      spaceId,
      enabled,
    }: {
      spaceId: string;
      enabled: boolean;
    }) => updateSpaceNotifications(spaceId, enabled),
    onMutate: () => ({ sessionUserId }),
    onSuccess: ({ enabled }, { spaceId }, context) => {
      if (!context?.sessionUserId) return;
      const queryKey = spacesListQueryKey(context.sessionUserId);
      // Reflect the server-confirmed value before announcing that the row is saved.
      queryClient.setQueryData<InventorySpaceSummary[]>(
        queryKey,
        (spaces) => spaces?.map((space) => space.id === spaceId
          ? { ...space, notificationsEnabled: enabled }
          : space),
      );
      void queryClient.invalidateQueries({
        queryKey,
      });
      if (context.sessionUserId === sessionUserId) void refetchSpaces();
    },
  });
}
