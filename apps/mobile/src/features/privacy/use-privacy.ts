import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptAiDataNotice,
  deleteAccount,
  getPrivacyStatus,
} from "../../services/api";

export const privacyStatusQueryKey = ["privacy-status"];

export const usePrivacyStatus = () =>
  useQuery({
    queryKey: privacyStatusQueryKey,
    queryFn: getPrivacyStatus,
  });

export const useAcceptAiDataNotice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptAiDataNotice,
    onSuccess: (response) => {
      queryClient.setQueryData(privacyStatusQueryKey, response.status);
      queryClient.invalidateQueries({ queryKey: privacyStatusQueryKey });
    },
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
    },
  });
};
