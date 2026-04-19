import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../../services/api";

export const useNotificationPreferences = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data);
    },
  });

  return {
    query,
    mutation,
  };
};
