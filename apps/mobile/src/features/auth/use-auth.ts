import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuthSession,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from "@expirymate/shared";
import {
  forgotPassword,
  getMe,
  login,
  logout,
  oauthLogin,
  register,
  requestEmailVerification,
} from "../../services/api";
import {
  clearUserScopedClientState,
  sessionQueryKeys,
  withSessionUser,
} from "./session-boundary";

export const authQueryKey = sessionQueryKeys.auth;

export const useAuth = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: authQueryKey,
    queryFn: getMe,
    retry: false,
  });

  const isRegistered = query.data?.accountType === "registered";
  const sessionUserId =
    isRegistered && query.data?.id ? query.data.id : undefined;

  const refreshSessionQueries = () => {
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.auth });
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.inventory });
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.recipes });
    queryClient.invalidateQueries({
      queryKey: sessionQueryKeys.notificationPreferences,
    });
    queryClient.invalidateQueries({
      queryKey: sessionQueryKeys.storageLocations,
    });
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.subscription });
    queryClient.invalidateQueries({ queryKey: sessionQueryKeys.privacy });
  };

  const bindRegisteredSession = (user: AuthUser) => {
    // Drop previous user cache/drafts, then seed auth so gates don't flicker.
    clearUserScopedClientState(queryClient);
    queryClient.setQueryData(authQueryKey, user);
    refreshSessionQueries();
  };

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => login(payload),
    onSuccess: (session: AuthSession) => {
      bindRegisteredSession(session.user);
    },
  });
  const registerMutation = useMutation({
    mutationFn: (payload: RegisterRequest) => register(payload),
    onSuccess: (result) => {
      if (
        "requiresEmailVerification" in result &&
        result.requiresEmailVerification
      ) {
        return;
      }
      if ("user" in result) {
        bindRegisteredSession(result.user);
      }
    },
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearUserScopedClientState(queryClient);
    },
  });
  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPassword,
  });
  const requestVerificationMutation = useMutation({
    mutationFn: requestEmailVerification,
    onSuccess: refreshSessionQueries,
  });
  const oauthMutation = useMutation({
    mutationFn: ({
      provider,
      providerToken,
      email,
      displayName,
      redirectUri,
      state,
    }: {
      provider: "apple" | "google" | "kakao" | "naver";
      providerToken: string;
      email?: string;
      displayName?: string;
      redirectUri?: string;
      state?: string;
    }) =>
      oauthLogin(provider, {
        providerToken,
        email,
        displayName,
        redirectUri,
        state,
      }),
    onSuccess: (session: AuthSession) => {
      bindRegisteredSession(session.user);
    },
  });

  return {
    query,
    isRegistered,
    sessionUserId,
    sessionQueryKey: (key: readonly string[]) =>
      withSessionUser(key, sessionUserId),
    loginMutation,
    registerMutation,
    logoutMutation,
    forgotPasswordMutation,
    requestVerificationMutation,
    oauthMutation,
  };
};
