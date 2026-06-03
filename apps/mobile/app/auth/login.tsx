import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { colors, spacing } from "../../src/shared/theme";

WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri({ scheme: "expirymate" });

export default function LoginScreen() {
  const { loginMutation, oauthMutation } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await loginMutation.mutateAsync({ email, password });
      router.back();
    } catch (error) {
      Alert.alert("로그인 실패", getErrorMessage(error));
    }
  };

  const handleAppleLogin = async () => {
    try {
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
      router.back();
    } catch (error) {
      if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
        return;
      }
      Alert.alert("Apple 로그인 실패", getErrorMessage(error));
    }
  };

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
      },
    });

  const handleKakaoLogin = () =>
    handleWebOAuth({
      provider: "kakao",
      clientId: process.env.EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID,
      url: "https://kauth.kakao.com/oauth/authorize",
      tokenParam: "access_token",
      params: {
        response_type: "token",
      },
    });

  const handleWebOAuth = async ({
    provider,
    clientId,
    url,
    tokenParam,
    params,
  }: {
    provider: "google" | "kakao";
    clientId?: string;
    url: string;
    tokenParam: string;
    params: Record<string, string>;
  }) => {
    try {
      if (!clientId) {
        throw new Error("OAuth client id 환경변수가 설정되지 않았어요.");
      }

      const authUrl = `${url}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        ...params,
      }).toString()}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== "success") {
        return;
      }

      const parsed = parseOAuthReturnUrl(result.url);
      const providerToken = parsed[tokenParam];

      if (!providerToken) {
        throw new Error("소셜 로그인 토큰을 받지 못했어요.");
      }

      await oauthMutation.mutateAsync({ provider, providerToken });
      router.back();
    } catch (error) {
      Alert.alert("소셜 로그인 실패", getErrorMessage(error));
    }
  };

  return (
    <Screen title="로그인" subtitle="계정으로 연결하면 익명으로 등록한 재료가 계정에 병합돼요.">
      <View style={styles.fieldGroup}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="이메일"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="비밀번호"
          style={styles.input}
        />
      </View>

      <Button
        onPress={handleLogin}
        loading={loginMutation.isPending}
        disabled={!email || !password}
        fullWidth
      >
        로그인
      </Button>

      <View style={styles.links}>
        <Pressable onPress={() => router.push("/auth/register")}>
          <Text style={styles.linkText}>회원가입</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/auth/forgot-password")}>
          <Text style={styles.linkText}>비밀번호 찾기</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Button variant="secondary" onPress={handleAppleLogin} fullWidth>
        Apple로 계속하기
      </Button>
      <Button variant="secondary" onPress={handleGoogleLogin} fullWidth>
        Google로 계속하기
      </Button>
      <Button variant="secondary" onPress={handleKakaoLogin} fullWidth>
        Kakao로 계속하기
      </Button>
    </Screen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
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
  fieldGroup: {
    gap: spacing.sm,
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
