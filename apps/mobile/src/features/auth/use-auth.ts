import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginRequest, RegisterRequest } from "@expirymate/shared";
import {
  forgotPassword,
  getMe,
  login,
  logout,
  oauthLogin,
  register,
  requestEmailVerification,
} from "../../services/api";

export const authQueryKey = ["auth", "me"];

export const useAuth = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: authQueryKey,
    queryFn: getMe,
  });

  const resetAppQueries = () => {
    queryClient.invalidateQueries({ queryKey: authQueryKey });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-list"] });
    queryClient.invalidateQueries({ queryKey: ["recipe-recommendations"] });
    queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    queryClient.invalidateQueries({ queryKey: ["subscription-entitlement"] });
  };

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => login(payload),
    onSuccess: resetAppQueries,
  });
  const registerMutation = useMutation({
    mutationFn: (payload: RegisterRequest) => register(payload),
    onSuccess: resetAppQueries,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: resetAppQueries,
  });
  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPassword,
  });
  const requestVerificationMutation = useMutation({
    mutationFn: requestEmailVerification,
    onSuccess: resetAppQueries,
  });
  const oauthMutation = useMutation({
    mutationFn: ({
      provider,
      providerToken,
      email,
      displayName,
    }: {
      provider: "apple" | "google" | "kakao";
      providerToken: string;
      email?: string;
      displayName?: string;
    }) => oauthLogin(provider, { providerToken, email, displayName }),
    onSuccess: resetAppQueries,
  });

  return {
    query,
    loginMutation,
    registerMutation,
    logoutMutation,
    forgotPasswordMutation,
    requestVerificationMutation,
    oauthMutation,
  };
};
