import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: spacesListQueryKey(sessionUserId),
      });
      void refetchSpaces();
    },
  });
}
