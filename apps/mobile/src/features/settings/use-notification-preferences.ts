import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../../services/api";

export const useNotificationPreferences = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(
    sessionQueryKeys.notificationPreferences,
    sessionUserId,
  );

  const query = useQuery({
    queryKey,
    queryFn: getNotificationPreferences,
    enabled: Boolean(sessionUserId),
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    query,
    mutation,
  };
};
