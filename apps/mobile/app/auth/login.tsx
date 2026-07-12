import { appBrand } from "@expirymate/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
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
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
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
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    }
  };

  return (
    <Screen
      title="어서 오세요"
      subtitle="계정으로 이어가면, 익명으로 넣은 재료도 함께 옮겨 드릴게요."
      footer={
        <Button
          onPress={handleLogin}
          loading={loginMutation.isPending}
          disabled={!email || !password}
          fullWidth
        >
          로그인할게요
        </Button>
      }
    >
      <View style={styles.brandRow}>
        <Mascot size="small" mood="idle" />
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>{appBrand.appNameKo}</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>이메일</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="예: jango@example.com"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
        />
        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="비밀번호를 입력해 주세요"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
        />
      </View>

      <View style={styles.links}>
        <Pressable
          onPress={() => router.push("/auth/register")}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>계정 만들기</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/auth/forgot-password")}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>비밀번호를 잊었어요</Text>
        </Pressable>
      </View>

      <View style={styles.oauthCard}>
        <Text style={styles.oauthTitle}>다른 방법으로 이어갈까요?</Text>
        <Pressable
          onPress={handleAppleLogin}
          style={({ pressed }) => [
            styles.oauthRow,
            pressed && styles.oauthRowPressed,
          ]}
        >
          <Text style={styles.oauthRowText}>Apple로 계속하기</Text>
        </Pressable>
        <Pressable
          onPress={handleGoogleLogin}
          style={({ pressed }) => [
            styles.oauthRow,
            pressed && styles.oauthRowPressed,
          ]}
        >
          <Text style={styles.oauthRowText}>Google로 계속하기</Text>
        </Pressable>
        <Pressable
          onPress={handleKakaoLogin}
          style={({ pressed }) => [
            styles.oauthRow,
            pressed && styles.oauthRowPressed,
          ]}
        >
          <Text style={styles.oauthRowText}>Kakao로 계속하기</Text>
        </Pressable>
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
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.label.fontWeight,
    color: colors.text,
    marginTop: spacing.xs,
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
    fontWeight: typography.body.fontWeight,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  linkButton: {
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  linkText: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: typography.title.fontWeight,
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
  oauthRowText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
});
