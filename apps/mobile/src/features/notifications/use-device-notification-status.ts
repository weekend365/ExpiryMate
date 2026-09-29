import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { getDeviceNotificationStatus } from "../../services/notifications";
import { useAuth } from "../auth/use-auth";

export function useDeviceNotificationStatus() {
  const { sessionUserId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["device-notification-status", sessionUserId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getDeviceNotificationStatus(),
    enabled: Boolean(sessionUserId),
    staleTime: 0,
    retry: false,
  });
  const connect = useMutation({
    mutationFn: () => getDeviceNotificationStatus(true),
    onSuccess: (status) => queryClient.setQueryData(queryKey, status),
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && sessionUserId) {
        void queryClient.invalidateQueries({
          queryKey: ["device-notification-status", sessionUserId],
        });
      }
    });
    return () => subscription.remove();
  }, [queryClient, sessionUserId]);
  return { query, connect };
}
