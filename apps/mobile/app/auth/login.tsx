import { appBrand, loginRequestSchema } from "@expirymate/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import { router, useLocalSearchParams } from "expo-router";
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
import { getAuthErrorMessage } from "../../src/features/auth/auth-errors";
import {
  useWebOAuth,
  type WebOAuthProvider,
} from "../../src/features/auth/use-web-oauth";
import { useAuth } from "../../src/features/auth/use-auth";
import { continuePendingSpaceInvitation } from "../../src/features/spaces/pending-invitation";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { publicWebUrl } from "../../src/shared/public-web-url";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

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
  const { pendingProvider, setPendingProvider, startWebOAuth } = useWebOAuth({
    completeSession: async (input) => {
      await oauthMutation.mutateAsync(input);
      if (!(await continuePendingSpaceInvitation())) {
        router.replace("/(tabs)/home");
      }
    },
  });

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
      const message = getAuthErrorMessage(error);
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
      Alert.alert("앗, 잠시 문제가 생겼어요", getAuthErrorMessage(error));
    } finally {
      setPendingProvider(null);
    }
  };

  const handleWebOAuth = (provider: WebOAuthProvider) => {
    void startWebOAuth(provider).catch((error) => {
      Alert.alert("앗, 잠시 문제가 생겼어요", getAuthErrorMessage(error));
    });
  };

  const handleKakaoLogin = () => handleWebOAuth("kakao");
  const handleNaverLogin = () => handleWebOAuth("naver");
  const handleGoogleLogin = () => handleWebOAuth("google");

  const toggleEmailExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setEmailExpanded((current) => !current);
  };

  const isBusy =
    pendingProvider !== null ||
    oauthMutation.isPending ||
    loginMutation.isPending;
  const naverClientId = process.env.EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID?.trim();
  const canEmailLogin =
    loginRequestSchema.shape.email.safeParse(email.trim()).success &&
    Boolean(password);

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
            <View style={styles.emailCard}>
              <Pressable
                onPress={toggleEmailExpanded}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel="이메일 입력 접기"
                accessibilityState={{ expanded: true }}
                hitSlop={{
                  top: spacing.sm,
                  bottom: spacing.sm,
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

              <View style={styles.formFields}>
                <EmailDomainInput
                  testID="login-email"
                  value={email}
                  onChangeText={setEmail}
                  autoCorrect={false}
                  placeholder="이메일"
                  editable={!isBusy}
                  style={styles.fieldWell}
                />
                <View style={styles.passwordBlock}>
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
                      styles.textLink,
                      styles.forgotLink,
                      pressed && styles.linkPressed,
                    ]}
                  >
                    <AppText
                      variant="bodySmall"
                      tone="primary"
                      numberOfLines={1}
                      style={styles.textLinkLabel}
                    >
                      비밀번호를 잊으셨나요?
                    </AppText>
                  </Pressable>
                </View>
              </View>

              <View style={styles.formActions}>
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
                  accessibilityLabel="아직 계정이 없으면 가입할게요"
                  style={({ pressed }) => [
                    styles.textLink,
                    styles.registerLink,
                    pressed && styles.linkPressed,
                  ]}
                >
                  <AppText
                    variant="bodySmall"
                    tone="primary"
                    numberOfLines={1}
                    style={styles.textLinkLabel}
                  >
                    아직 계정이 없으면 가입할게요
                  </AppText>
                </Pressable>
              </View>
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

          <AppText
            variant="caption"
            tone="muted"
            style={styles.legalCopy}
            accessibilityRole="text"
          >
            계속하면{" "}
            <AppText
              variant="caption"
              tone="primary"
              accessibilityRole="link"
              accessibilityLabel="이용약관 살펴보기"
              onPress={
                isBusy
                  ? undefined
                  : () => {
                      void Linking.openURL(publicWebUrl("/terms"));
                    }
              }
              style={styles.legalInlineLink}
            >
              이용약관
            </AppText>
            과{" "}
            <AppText
              variant="caption"
              tone="primary"
              accessibilityRole="link"
              accessibilityLabel="개인정보 안내 살펴보기"
              onPress={
                isBusy
                  ? undefined
                  : () => {
                      void Linking.openURL(publicWebUrl("/privacy"));
                    }
              }
              style={styles.legalInlineLink}
            >
              개인정보 안내
            </AppText>
            에 동의하는 걸로 볼게요.
          </AppText>
        </ScrollView>
      </View>
    </Screen>
  );
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
    // Soft depth so the form reads as the foreground over the hero art.
    shadowColor: colors.text,
    shadowOpacity: 0.06,
    shadowRadius: spacing.xs,
    shadowOffset: { width: 0, height: spacing.xxs },
    elevation: 2,
  },
  emailToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    // Compact header; hitSlop keeps the 48px touch target.
    paddingVertical: spacing.xxs,
  },
  formFields: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  fieldWell: {
    backgroundColor: colors.background,
  },
  passwordBlock: {
    // Optical: keep the forgot-password link attached to the field.
    gap: spacing.xxs,
  },
  passwordField: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
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
  formActions: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  textLink: {
    justifyContent: "center",
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  textLinkLabel: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  forgotLink: {
    alignSelf: "flex-end",
  },
  registerLink: {
    alignSelf: "center",
  },
  legalCopy: {
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  legalInlineLink: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  linkPressed: {
    opacity: 0.7,
  },
});
