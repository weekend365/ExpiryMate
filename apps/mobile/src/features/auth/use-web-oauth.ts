import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { startOAuth } from "../../services/api";
import { parseOAuthReturnUrl } from "./oauth-return";

WebBrowser.maybeCompleteAuthSession();

export type WebOAuthProvider = "google" | "kakao" | "naver";

/**
 * URI WebBrowser waits for. Must be an app / Expo scheme — not https.
 * Expo Go → exp://…/--/oauth, standalone → expirymate://oauth
 */
export const appReturnUri = AuthSession.makeRedirectUri({
  scheme: "expirymate",
  path: "oauth",
});

export const webOAuthProviders: Record<
  WebOAuthProvider,
  {
    url: string;
    tokenParam: string;
    params: Record<string, string>;
    includePkce: boolean;
    clientId: string | undefined;
  }
> = {
  kakao: {
    url: "https://kauth.kakao.com/oauth/authorize",
    tokenParam: "code",
    params: { response_type: "code" },
    includePkce: true,
    clientId: process.env.EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID,
  },
  naver: {
    url: "https://nid.naver.com/oauth2.0/authorize",
    tokenParam: "code",
    params: { response_type: "code" },
    includePkce: false,
    clientId: process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID,
  },
  google: {
    url: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenParam: "code",
    params: {
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
    },
    includePkce: true,
    clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
  },
};

export function useWebOAuth({
  completeSession,
}: {
  completeSession: (input: {
    provider: WebOAuthProvider;
    providerToken: string;
    state?: string;
  }) => Promise<void>;
}) {
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const startWebOAuth = async (provider: WebOAuthProvider) => {
    const config = webOAuthProviders[provider];
    try {
      setPendingProvider(provider);
      if (!config.clientId?.trim()) {
        throw new Error("소셜 로그인 설정을 아직 준비 중이에요.");
      }

      const oauthStart = await startOAuth({
        provider,
        returnUri: appReturnUri,
      });

      const authUrl = `${config.url}?${new URLSearchParams({
        client_id: config.clientId.trim(),
        redirect_uri: oauthStart.redirectUri,
        state: oauthStart.state,
        ...(config.includePkce
          ? {
              code_challenge: oauthStart.codeChallenge,
              code_challenge_method: oauthStart.codeChallengeMethod,
            }
          : {}),
        ...config.params,
      }).toString()}`;

      // Wait for the app scheme deep link (not the https provider redirect).
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        appReturnUri,
      );

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type !== "success" || !("url" in result) || !result.url) {
        throw new Error("소셜 로그인을 끝까지 마치지 못했어요.");
      }

      const parsed = parseOAuthReturnUrl(result.url);
      const providerToken = parsed[config.tokenParam];
      const state = parsed.state || oauthStart.state;

      if (!providerToken) {
        throw new Error("소셜 로그인 토큰을 받지 못했어요.");
      }

      await completeSession({
        provider,
        providerToken,
        state,
      });
    } finally {
      setPendingProvider(null);
    }
  };

  return {
    pendingProvider,
    setPendingProvider,
    startWebOAuth,
  };
}
