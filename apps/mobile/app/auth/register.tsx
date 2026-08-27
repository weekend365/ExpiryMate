import { registerRequestSchema } from "@expirymate/shared";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { AppTextInput } from "../../src/components/AppTextInput";
import { Button } from "../../src/components/Button";
import { EmailDomainInput } from "../../src/components/EmailDomainInput";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { getAuthErrorMessage } from "../../src/features/auth/auth-errors";
import { useAuth } from "../../src/features/auth/use-auth";
import { continuePendingSpaceInvitation } from "../../src/features/spaces/pending-invitation";
import { publicWebUrl } from "../../src/shared/public-web-url";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

export default function RegisterScreen() {
  const { registerMutation } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isBusy = registerMutation.isPending;
  const canSubmit = registerRequestSchema
    .pick({ email: true, password: true })
    .safeParse({
      email: email.trim(),
      password,
    }).success;

  const goToLogin = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/auth/login");
  };

  const handleRegister = async () => {
    if (!canSubmit || isBusy) {
      return;
    }

    try {
      const trimmedName = displayName.trim();
      const result = await registerMutation.mutateAsync({
        email: email.trim(),
        password,
        displayName: trimmedName || undefined,
      });

      if (
        "requiresEmailVerification" in result &&
        result.requiresEmailVerification
      ) {
        router.replace({
          pathname: "/auth/verify-pending",
          params: { email: result.email },
        });
        return;
      }

      if (!(await continuePendingSpaceInvitation())) {
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getAuthErrorMessage(error));
    }
  };

  return (
    <Screen
      contentWidth="form"
      density="compact"
      footer={
        <Button
          onPress={() => {
            void handleRegister();
          }}
          loading={isBusy}
          disabled={!canSubmit}
          fullWidth
        >
          이걸로 시작할까요?
        </Button>
      }
    >
      <View style={styles.page}>
        <Pressable
          onPress={goToLogin}
          disabled={isBusy}
          hitSlop={{
            top: spacing.sm,
            bottom: spacing.sm,
            left: spacing.xs,
            right: spacing.xs,
          }}
          accessibilityRole="button"
          accessibilityLabel="로그인으로"
          style={({ pressed }) => [
            styles.textLink,
            pressed && styles.linkPressed,
          ]}
        >
          <AppText
            variant="bodySmall"
            tone="subtext"
            style={styles.textLinkLabel}
          >
            로그인으로
          </AppText>
        </Pressable>

        <View style={styles.hero}>
          <Mascot size="small" mood="idle" style={styles.mascot} />
          <View style={styles.heroCopy}>
            <AppText variant="heading" style={styles.title}>
              이메일로 시작해요
            </AppText>
            <AppText variant="bodySmall" tone="subtext">
              필요한 것만 적을게요. 이름은 나중에 적어도 괜찮아요.
            </AppText>
          </View>
        </View>

        <View style={styles.formFields}>
          <EmailDomainInput
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            editable={!isBusy}
            returnKeyType="next"
          />
          <View
            style={[
              styles.passwordField,
              passwordFocused && styles.passwordFieldFocused,
            ]}
          >
            <AppTextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              textContentType="newPassword"
              placeholder="비밀번호 8자 이상"
              editable={!isBusy}
              returnKeyType="next"
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
          <View style={styles.nameBlock}>
            <AppTextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="이름 또는 닉네임 (선택)"
              editable={!isBusy}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleRegister();
              }}
              style={styles.nameInput}
            />
            <AppText variant="caption" tone="muted">
              비워 두셔도 되고, 나중에 바꿔도 괜찮아요.
            </AppText>
          </View>
          <AppText
            variant="caption"
            tone="muted"
            style={styles.legalCopy}
            accessibilityRole="text"
          >
            가입하면{" "}
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
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
  },
  textLink: {
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  textLinkLabel: {
    fontFamily: typography.bodyStrong.fontFamily,
  },
  hero: {
    gap: spacing.xs,
  },
  mascot: {
    alignSelf: "flex-start",
  },
  heroCopy: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
  },
  formFields: {
    gap: spacing.sm,
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
  nameBlock: {
    // Optical: keep the optional-name hint attached to the field.
    gap: spacing.xxs,
  },
  nameInput: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
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
