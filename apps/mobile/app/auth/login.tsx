import { appBrand } from "@expirymate/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { EmailDomainInput } from "../../src/components/EmailDomainInput";
import { Mascot } from "../../src/components/Mascot";
import { OAuthButton } from "../../src/components/OAuthButton";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { startOAuth } from "../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

WebBrowser.maybeCompleteAuthSession();

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
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { loginMutation, oauthMutation } = useAuth();
  const [email, setEmail] = useState(
    () => (typeof emailParam === "string" ? emailParam : emailParam?.[0]) ?? "",
  );
  const [password, setPassword] = useState("");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    try {
      await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      });
      router.replace("/(tabs)/home");
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes("메일 확인")) {
        Alert.alert("메일 확인이 필요해요", message, [
          {
            text: "메일함 확인으로",
            onPress: () =>
              router.replace({
                pathname: "/auth/verify-pending",
                params: { email: email.trim() },
              }),
          },
          { text: "조금 뒤에 할게요", style: "cancel" },
        ]);
        return;
      }
      Alert.alert("앗, 잠시 문제가 생겼어요", message);
    }
  };

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
      },
      includePkce: true,
    });

  const handleNaverLogin = () =>
    handleWebOAuth({
      provider: "naver",
      clientId: process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID,
      url: "https://nid.naver.com/oauth2.0/authorize",
      tokenParam: "code",
      params: {
        response_type: "code",
      },
      includePkce: false,
    });

  const handleGoogleLogin = () =>
    handleWebOAuth({
      provider: "google",
      clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
      url: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenParam: "code",
      params: {
        response_type: "code",
        scope: "openid email profile",
        access_type: "online",
        prompt: "select_account",
      },
      includePkce: true,
    });

  const handleWebOAuth = async ({
    provider,
    clientId,
    url,
    tokenParam,
    params,
    includePkce,
  }: {
    provider: WebOAuthProvider;
    clientId?: string;
    url: string;
    tokenParam: string;
    params: Record<string, string>;
    includePkce: boolean;
  }) => {
    try {
      setPendingProvider(provider);
      if (!clientId?.trim()) {
        throw new Error("소셜 로그인 설정을 아직 준비 중이에요.");
      }

      const oauthStart = await startOAuth({
        provider,
        returnUri: appReturnUri,
      });

      const authUrl = `${url}?${new URLSearchParams({
        client_id: clientId.trim(),
        redirect_uri: oauthStart.redirectUri,
        state: oauthStart.state,
        ...(includePkce
          ? {
              code_challenge: oauthStart.codeChallenge,
              code_challenge_method: oauthStart.codeChallengeMethod,
            }
          : {}),
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
      const state = parsed.state || oauthStart.state;

      if (!providerToken) {
        throw new Error("소셜 로그인 토큰을 받지 못했어요.");
      }

      await oauthMutation.mutateAsync({
        provider,
        providerToken,
        state,
      });
      router.replace("/(tabs)/home");
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    } finally {
      setPendingProvider(null);
    }
  };

  const isBusy =
    pendingProvider !== null ||
    oauthMutation.isPending ||
    loginMutation.isPending;
  const naverClientId = process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID?.trim();
  const canEmailLogin = Boolean(email.trim() && password);

  return (
    <Screen
      title="어서 오세요"
      subtitle="계정으로 이어가면 장고가 냉장고를 함께 챙겨 드릴게요."
    >
      <View style={styles.brandRow}>
        <Mascot size="small" mood="idle" />
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>{appBrand.appNameKo}</Text>
        </View>
      </View>

      <View style={styles.emailCard}>
        <Text style={styles.emailTitle}>이메일로 이어갈까요?</Text>
        <EmailDomainInput
          value={email}
          onChangeText={setEmail}
          autoCorrect={false}
          placeholder="아이디"
          editable={!isBusy}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="비밀번호"
          placeholderTextColor={colors.mutedText}
          editable={!isBusy}
          style={styles.input}
        />
        <View style={styles.emailLinks}>
          <Button
            variant="secondary"
            size="small"
            onPress={() => router.push("/auth/register")}
            disabled={isBusy}
          >
            함께 시작하기
          </Button>
          <Pressable
            onPress={() => router.push("/auth/forgot-password")}
            disabled={isBusy}
            hitSlop={spacing.xs}
            accessibilityRole="button"
            accessibilityLabel="비밀번호를 잊으셨나요?"
            style={({ pressed }) => [
              styles.emailLink,
              pressed && styles.emailLinkPressed,
            ]}
          >
            <Text style={styles.emailLinkText}>비밀번호를 잊으셨나요?</Text>
          </Pressable>
        </View>
        <Button
          onPress={() => {
            void handleEmailLogin();
          }}
          loading={loginMutation.isPending}
          disabled={!canEmailLogin || (isBusy && !loginMutation.isPending)}
          fullWidth
        >
          이메일로 이어갈게요
        </Button>
      </View>

      <View style={styles.oauthSection}>
        <Text style={styles.oauthTitle}>다른 방법으로도 이어갈 수 있어요</Text>
        <View style={styles.oauthList}>
          <OAuthButton
            provider="kakao"
            label="카카오로 이어갈게요"
            onPress={handleKakaoLogin}
            loading={pendingProvider === "kakao"}
            disabled={isBusy && pendingProvider !== "kakao"}
          />
          {naverClientId ? (
            <OAuthButton
              provider="naver"
              label="네이버로 이어갈게요"
              onPress={handleNaverLogin}
              loading={pendingProvider === "naver"}
              disabled={isBusy && pendingProvider !== "naver"}
            />
          ) : null}
          <OAuthButton
            provider="google"
            label="Google로 이어갈게요"
            onPress={handleGoogleLogin}
            loading={pendingProvider === "google"}
            disabled={isBusy && pendingProvider !== "google"}
          />
          {Platform.OS === "ios" ? (
            <OAuthButton
              provider="apple"
              label="Apple로 이어갈게요"
              onPress={handleAppleLogin}
              loading={pendingProvider === "apple"}
              disabled={isBusy && pendingProvider !== "apple"}
            />
          ) : null}
        </View>
      </View>
    </Screen>
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
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  emailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emailTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  input: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  emailLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  emailLink: {
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  emailLinkPressed: {
    opacity: 0.7,
  },
  emailLinkText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
  },
  oauthSection: {
    gap: spacing.xs,
  },
  oauthTitle: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  oauthList: {
    gap: spacing.xs,
  },
});
