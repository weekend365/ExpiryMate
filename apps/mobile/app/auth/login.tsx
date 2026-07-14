import { appBrand } from "@expirymate/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

WebBrowser.maybeCompleteAuthSession();

/** HTTPS Redirect URI registered in Kakao/Naver/Google consoles. */
const providerRedirectUri =
  process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI?.trim() ?? "";

/**
 * URI WebBrowser waits for. Must be an app / Expo scheme — not https.
 * Expo Go → exp://…/--/oauth, standalone → expirymate://oauth
 */
const appReturnUri = AuthSession.makeRedirectUri({
  scheme: "expirymate",
  path: "oauth",
});

type WebOAuthProvider = "google" | "kakao" | "naver";

export default function LoginScreen() {
  const { oauthMutation } = useAuth();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const handleAppleLogin = async () => {
    try {
      setPendingProvider("apple");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple 로그인 토큰을 받지 못했어요.");
      }

      await oauthMutation.mutateAsync({
        provider: "apple",
        providerToken: credential.identityToken,
        email: credential.email ?? undefined,
        displayName: [credential.fullName?.familyName, credential.fullName?.givenName]
          .filter(Boolean)
          .join(" "),
      });
      router.replace("/(tabs)/home");
    } catch (error) {
      if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
        return;
      }
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    } finally {
      setPendingProvider(null);
    }
  };

  const handleKakaoLogin = () =>
    handleWebOAuth({
      provider: "kakao",
      clientId: process.env.EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID,
      url: "https://kauth.kakao.com/oauth/authorize",
      tokenParam: "code",
      params: {
        response_type: "code",
        state: appReturnUri,
      },
      includeRedirectUriInPayload: true,
    });

  const handleNaverLogin = () =>
    handleWebOAuth({
      provider: "naver",
      clientId: process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID,
      url: "https://nid.naver.com/oauth2.0/authorize",
      tokenParam: "code",
      params: {
        response_type: "code",
        state: appReturnUri,
      },
      oauthState: appReturnUri,
    });

  const handleGoogleLogin = () =>
    handleWebOAuth({
      provider: "google",
      clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
      url: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenParam: "id_token",
      params: {
        response_type: "id_token",
        scope: "openid email profile",
        nonce: String(Date.now()),
        state: appReturnUri,
      },
    });

  const handleWebOAuth = async ({
    provider,
    clientId,
    url,
    tokenParam,
    params,
    oauthState,
    includeRedirectUriInPayload = false,
  }: {
    provider: WebOAuthProvider;
    clientId?: string;
    url: string;
    tokenParam: string;
    params: Record<string, string>;
    oauthState?: string;
    includeRedirectUriInPayload?: boolean;
  }) => {
    try {
      setPendingProvider(provider);
      if (!clientId?.trim()) {
        throw new Error("소셜 로그인 설정을 아직 준비 중이에요.");
      }

      if (!providerRedirectUri) {
        throw new Error(
          "로그인 연결 주소(EXPO_PUBLIC_OAUTH_REDIRECT_URI)를 아직 준비 중이에요.",
        );
      }

      const authUrl = `${url}?${new URLSearchParams({
        client_id: clientId.trim(),
        redirect_uri: providerRedirectUri,
        ...params,
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
      const providerToken = parsed[tokenParam];

      if (!providerToken) {
        throw new Error("소셜 로그인 토큰을 받지 못했어요.");
      }

      await oauthMutation.mutateAsync({
        provider,
        providerToken,
        ...(oauthState ? { state: oauthState } : {}),
        ...(includeRedirectUriInPayload
          ? { redirectUri: providerRedirectUri }
          : {}),
      });
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    } finally {
      setPendingProvider(null);
    }
  };

  const isBusy = pendingProvider !== null || oauthMutation.isPending;
  const naverClientId = process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID?.trim();

  return (
    <Screen
      title="어서 오세요"
      subtitle="계정으로 이어가면 장고가 냉장고를 함께 챙겨 드릴게요."
      footer={
        <Button
          onPress={handleKakaoLogin}
          loading={pendingProvider === "kakao"}
          disabled={isBusy && pendingProvider !== "kakao"}
          fullWidth
        >
          카카오로 이어갈게요
        </Button>
      }
    >
      <View style={styles.brandRow}>
        <Mascot size="small" mood="idle" />
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>{appBrand.appNameKo}</Text>
        </View>
      </View>

      <View style={styles.oauthCard}>
        <Text style={styles.oauthTitle}>다른 방법으로 이어갈까요?</Text>
        {naverClientId ? (
          <OAuthRow
            label="네이버로 이어갈게요"
            onPress={handleNaverLogin}
            loading={pendingProvider === "naver"}
            disabled={isBusy && pendingProvider !== "naver"}
          />
        ) : null}
        <OAuthRow
          label="Google로 이어갈게요"
          onPress={handleGoogleLogin}
          loading={pendingProvider === "google"}
          disabled={isBusy && pendingProvider !== "google"}
        />
        {Platform.OS === "ios" ? (
          <OAuthRow
            label="Apple로 이어갈게요"
            onPress={handleAppleLogin}
            loading={pendingProvider === "apple"}
            disabled={isBusy && pendingProvider !== "apple"}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function OAuthRow({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.oauthRow,
        pressed && styles.oauthRowPressed,
        (disabled || loading) && styles.oauthRowDisabled,
      ]}
    >
      <Text style={styles.oauthRowText}>
        {loading ? "잠시만요…" : label}
      </Text>
    </Pressable>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

function parseOAuthReturnUrl(url: string): Record<string, string> {
  const [, fragment = ""] = url.split("#");
  const [baseUrl, query = ""] = url.split("?");
  const params = new URLSearchParams(query.split("#")[0]);
  const fragmentParams = new URLSearchParams(fragment);

  return {
    ...Object.fromEntries(params.entries()),
    ...Object.fromEntries(fragmentParams.entries()),
    url: baseUrl,
  };
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  brandBadgeText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  oauthCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  oauthTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontWeight: typography.label.fontWeight,
    color: colors.mutedText,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  oauthRow: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  oauthRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  oauthRowDisabled: {
    opacity: 0.5,
  },
  oauthRowText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
});
