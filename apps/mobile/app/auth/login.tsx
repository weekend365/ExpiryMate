import { appBrand } from "@expirymate/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  ImageBackground,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import loginWelcomeBg from "../../assets/backgrounds/login-welcome-bg.png";
import { AppText } from "../../src/components/AppText";
import { AppTextInput } from "../../src/components/AppTextInput";
import { Button } from "../../src/components/Button";
import { EmailDomainInput } from "../../src/components/EmailDomainInput";
import { OAuthButton } from "../../src/components/OAuthButton";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { continuePendingSpaceInvitation } from "../../src/features/spaces/pending-invitation";
import { startOAuth } from "../../src/services/api";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { publicWebUrl } from "../../src/shared/public-web-url";
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

function resolveEmailParam(emailParam?: string | string[]) {
  return (typeof emailParam === "string" ? emailParam : emailParam?.[0]) ?? "";
}

export default function LoginScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const initialEmail = resolveEmailParam(emailParam);
  const { loginMutation, oauthMutation } = useAuth();
  const { shouldStackDense } = useResponsiveLayout();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(() =>
    Boolean(initialEmail),
  );
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    try {
      await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      });
      if (!(await continuePendingSpaceInvitation())) {
        router.replace("/(tabs)/home");
      }
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
        displayName: [
          credential.fullName?.familyName,
          credential.fullName?.givenName,
        ]
          .filter(Boolean)
          .join(" "),
      });
      if (!(await continuePendingSpaceInvitation())) {
        router.replace("/(tabs)/home");
      }
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
      if (!(await continuePendingSpaceInvitation())) {
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    } finally {
      setPendingProvider(null);
    }
  };

  const toggleEmailExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setEmailExpanded((current) => !current);
  };

  const isBusy =
    pendingProvider !== null ||
    oauthMutation.isPending ||
    loginMutation.isPending;
  const naverClientId = process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID?.trim();
  const canEmailLogin = Boolean(email.trim() && password);

  return (
    <Screen
      scroll={false}
      contentWidth="form"
      testID="login-screen"
      contentStyle={styles.screenContent}
    >
      <View style={styles.loginScene}>
        <ImageBackground
          source={loginWelcomeBg}
          style={styles.loginSceneBackground}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          importantForAccessibility="no"
        />
        <View
          pointerEvents="none"
          style={styles.loginSceneVeil}
          importantForAccessibility="no-hide-descendants"
        />
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View
            style={[
              styles.welcomeHero,
              shouldStackDense && styles.welcomeHeroCompact,
            ]}
            accessibilityRole="summary"
            accessibilityLabel={`${appBrand.characterNameKo}예요. 냉장고, 같이 챙길까요?`}
          >
            <View style={styles.brandBadge}></View>
            <AppText variant="title" style={styles.welcomeTitle}>
              장고야 부탁해
            </AppText>
            <AppText
              variant="bodySmall"
              tone="subtext"
              style={styles.welcomeSubtitle}
            >
              냉장고, 저와 함께 챙겨볼까요?
            </AppText>
          </View>

          <View style={styles.primaryPath}>
            <OAuthButton
              provider="kakao"
              label="카카오로 들어가기"
              onPress={handleKakaoLogin}
              loading={pendingProvider === "kakao"}
              disabled={isBusy && pendingProvider !== "kakao"}
            />
            {naverClientId ? (
              <OAuthButton
                provider="naver"
                label="네이버로 들어가기"
                onPress={handleNaverLogin}
                loading={pendingProvider === "naver"}
                disabled={isBusy && pendingProvider !== "naver"}
              />
            ) : null}
            <OAuthButton
              provider="google"
              label="Google로 들어가기"
              onPress={handleGoogleLogin}
              loading={pendingProvider === "google"}
              disabled={isBusy && pendingProvider !== "google"}
            />
            {Platform.OS === "ios" ? (
              <OAuthButton
                provider="apple"
                label="Apple로 들어가기"
                onPress={handleAppleLogin}
                loading={pendingProvider === "apple"}
                disabled={isBusy && pendingProvider !== "apple"}
              />
            ) : null}
          </View>

          <View style={styles.orDivider} accessibilityRole="text">
            <View style={styles.orLine} />
            <AppText variant="caption" tone="muted" scaleRole="chrome">
              또는
            </AppText>
            <View style={styles.orLine} />
          </View>

          {emailExpanded ? (
            <View
              style={[
                styles.emailCard,
                shouldStackDense && styles.emailCardCompact,
              ]}
            >
              <Pressable
                onPress={toggleEmailExpanded}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="이메일 입력 접기"
                accessibilityState={{ expanded: true }}
                hitSlop={{
                  top: spacing.xs,
                  bottom: spacing.xs,
                  left: spacing.xs,
                  right: spacing.xs,
                }}
                style={({ pressed }) => [
                  styles.emailToggleRow,
                  pressed && styles.linkPressed,
                ]}
              >
                <AppText variant="label" tone="muted" scaleRole="chrome">
                  이메일로 계속하기
                </AppText>
                <ChevronUp
                  color={colors.mutedText}
                  size={spacing.sm + spacing.xxs}
                  strokeWidth={2.4}
                />
              </Pressable>

              <View style={styles.fieldBlock}>
                <EmailDomainInput
                  testID="login-email"
                  value={email}
                  onChangeText={setEmail}
                  autoCorrect={false}
                  placeholder="이메일"
                  editable={!isBusy}
                />
              </View>

              <View style={styles.fieldBlock}>
                <View
                  style={[
                    styles.passwordField,
                    passwordFocused && styles.passwordFieldFocused,
                  ]}
                >
                  <AppTextInput
                    testID="login-password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!passwordVisible}
                    textContentType="password"
                    placeholder="비밀번호"
                    editable={!isBusy}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    style={styles.passwordInput}
                  />
                  <Pressable
                    onPress={() => setPasswordVisible((current) => !current)}
                    disabled={isBusy}
                    accessibilityRole="button"
                    accessibilityLabel={
                      passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"
                    }
                    hitSlop={{
                      top: spacing.xs,
                      bottom: spacing.xs,
                      left: spacing.xs,
                      right: spacing.xs,
                    }}
                    style={({ pressed }) => [
                      styles.passwordToggle,
                      pressed && styles.linkPressed,
                    ]}
                  >
                    {passwordVisible ? (
                      <EyeOff
                        color={colors.subtext}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.2}
                      />
                    ) : (
                      <Eye
                        color={colors.subtext}
                        size={spacing.sm + spacing.xxs}
                        strokeWidth={2.2}
                      />
                    )}
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => router.push("/auth/forgot-password")}
                  disabled={isBusy}
                  hitSlop={{
                    top: spacing.sm,
                    bottom: spacing.sm,
                    left: spacing.xs,
                    right: spacing.xs,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="비밀번호를 잊으셨나요?"
                  style={({ pressed }) => [
                    styles.forgotLink,
                    pressed && styles.linkPressed,
                  ]}
                >
                  <AppText
                    variant="bodySmall"
                    tone="primary"
                    numberOfLines={1}
                    style={styles.forgotLinkText}
                  >
                    비밀번호를 잊으셨나요?
                  </AppText>
                </Pressable>
              </View>

              <Button
                testID="login-submit-button"
                onPress={() => {
                  void handleEmailLogin();
                }}
                loading={loginMutation.isPending}
                disabled={
                  !canEmailLogin || (isBusy && !loginMutation.isPending)
                }
                fullWidth
              >
                들어가 볼까요?
              </Button>
            </View>
          ) : (
            <Button
              testID="login-email-expand"
              variant="surface"
              onPress={toggleEmailExpanded}
              disabled={isBusy}
              fullWidth
              icon={ChevronDown}
              iconPosition="right"
            >
              이메일로 계속하기
            </Button>
          )}

          <View
            style={[
              styles.secondaryLinks,
              shouldStackDense && styles.secondaryLinksStacked,
            ]}
          >
            <Pressable
              onPress={() => router.push("/auth/register")}
              disabled={isBusy}
              hitSlop={{
                top: spacing.sm,
                bottom: spacing.sm,
                left: spacing.xs,
                right: spacing.xs,
              }}
              accessibilityRole="button"
              accessibilityLabel="처음이에요"
              style={({ pressed }) => [
                styles.secondaryLink,
                pressed && styles.linkPressed,
              ]}
            >
              <AppText
                variant="bodySmall"
                tone="primary"
                numberOfLines={1}
                style={styles.secondaryLinkText}
              >
                처음이에요
              </AppText>
            </Pressable>
            {shouldStackDense ? null : (
              <AppText variant="caption" tone="muted">
                ·
              </AppText>
            )}
            <Pressable
              onPress={() => router.push("/spaces/invitations/code")}
              disabled={isBusy}
              hitSlop={{
                top: spacing.sm,
                bottom: spacing.sm,
                left: spacing.xs,
                right: spacing.xs,
              }}
              accessibilityRole="button"
              accessibilityLabel="초대 코드로 올래요"
              style={({ pressed }) => [
                styles.secondaryLink,
                pressed && styles.linkPressed,
              ]}
            >
              <AppText
                variant="bodySmall"
                tone="primary"
                numberOfLines={1}
                style={styles.secondaryLinkText}
              >
                초대 코드로 올래요
              </AppText>
            </Pressable>
          </View>

          <View style={styles.legalLinks} accessibilityRole="text">
            <AppText variant="caption" tone="muted" style={styles.legalLead}>
              들어가면 이용약관과 개인정보 안내에 동의하는 걸로 볼게요.
            </AppText>
            <View style={styles.legalRow}>
              <Pressable
                onPress={() => void Linking.openURL(publicWebUrl("/terms"))}
                disabled={isBusy}
                hitSlop={spacing.xs}
                accessibilityRole="link"
                accessibilityLabel="이용약관 살펴보기"
                style={({ pressed }) => [
                  styles.legalLink,
                  pressed && styles.linkPressed,
                ]}
              >
                <AppText variant="caption" tone="primary" style={styles.legalLinkText}>
                  이용약관
                </AppText>
              </Pressable>
              <AppText variant="caption" tone="muted">
                ·
              </AppText>
              <Pressable
                onPress={() => void Linking.openURL(publicWebUrl("/privacy"))}
                disabled={isBusy}
                hitSlop={spacing.xs}
                accessibilityRole="link"
                accessibilityLabel="개인정보 안내 살펴보기"
                style={({ pressed }) => [
                  styles.legalLink,
                  pressed && styles.linkPressed,
                ]}
              >
                <AppText variant="caption" tone="primary" style={styles.legalLinkText}>
                  개인정보 안내
                </AppText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
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
  screenContent: {
    flex: 1,
    gap: spacing.none,
    paddingHorizontal: spacing.none,
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  loginScene: {
    flex: 1,
    overflow: "hidden",
  },
  loginSceneBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  loginSceneVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    // Keep light so the baked-in greeter on the mat stays readable.
    opacity: 0.16,
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  welcomeHero: {
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  welcomeHeroCompact: {
    gap: spacing.xxs,
  },
  brandBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: "100%",
  },
  welcomeTitle: {
    textAlign: "center",
  },
  welcomeSubtitle: {
    textAlign: "center",
  },
  primaryPath: {
    gap: spacing.xs,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  emailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
    // Soft depth so the form reads as the foreground over the hero art.
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: spacing.xs,
    shadowOffset: { width: 0, height: spacing.xxs },
    elevation: 2,
  },
  emailCardCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  emailToggleRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  passwordField: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.md,
    // Optical: keep icon button inside the field without crowding the text.
    paddingRight: spacing.xxs,
  },
  passwordFieldFocused: {
    borderColor: colors.primary,
  },
  passwordInput: {
    flex: 1,
    minHeight: touchTarget.cta,
    paddingVertical: spacing.xs,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  passwordToggle: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotLink: {
    // Visual height stays compact; hitSlop keeps the 48px touch target.
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
  forgotLinkText: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  secondaryLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  secondaryLinksStacked: {
    flexDirection: "column",
    gap: spacing.xxs,
  },
  secondaryLink: {
    // Compact row; hitSlop on Pressable keeps the touch target.
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  secondaryLinkText: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  legalLinks: {
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  legalLead: {
    textAlign: "center",
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  legalLink: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  legalLinkText: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  linkPressed: {
    opacity: 0.7,
  },
});
