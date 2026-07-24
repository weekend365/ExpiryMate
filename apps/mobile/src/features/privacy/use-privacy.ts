import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptAiDataNotice,
  deleteAccount,
  deleteRecommendationHistory,
  getPrivacyStatus,
  revokeAiDataNotice,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  clearUserScopedClientState,
  sessionQueryKeys,
  withSessionUser,
} from "../auth/session-boundary";
import {
  recipeFavoritesQueryKey,
  recipeRecommendationsQueryKey,
} from "../recipes/use-recipe-recommendations";

export const privacyStatusQueryKey = sessionQueryKeys.privacy;

export const usePrivacyStatus = () => {
  const { sessionUserId } = useAuth();

  return useQuery({
    queryKey: withSessionUser(privacyStatusQueryKey, sessionUserId),
    queryFn: getPrivacyStatus,
    enabled: Boolean(sessionUserId),
  });
};

export const useAcceptAiDataNotice = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(privacyStatusQueryKey, sessionUserId);

  return useMutation({
    mutationFn: acceptAiDataNotice,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response.status);
      queryClient.invalidateQueries({ queryKey: privacyStatusQueryKey });
    },
  });
};

export const useRevokeAiDataNotice = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(privacyStatusQueryKey, sessionUserId);

  return useMutation({
    mutationFn: revokeAiDataNotice,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response.status);
      queryClient.invalidateQueries({ queryKey: privacyStatusQueryKey });
    },
  });
};

export const useDeleteRecommendationHistory = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const privacyQueryKey = withSessionUser(privacyStatusQueryKey, sessionUserId);

  return useMutation({
    mutationFn: deleteRecommendationHistory,
    onSuccess: (response) => {
      queryClient.setQueryData(privacyQueryKey, response.status);
      queryClient.invalidateQueries({ queryKey: privacyStatusQueryKey });
      queryClient.invalidateQueries({ queryKey: recipeRecommendationsQueryKey });
      queryClient.invalidateQueries({ queryKey: recipeFavoritesQueryKey });
    },
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      clearUserScopedClientState(queryClient);
    },
  });
};
