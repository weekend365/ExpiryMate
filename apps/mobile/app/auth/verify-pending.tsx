import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { colors, spacing, touchTarget, typography } from "../../src/shared/theme";

export default function VerifyPendingScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { query, requestVerificationMutation } = useAuth();
  const email =
    (typeof emailParam === "string" ? emailParam : emailParam?.[0]) ??
    query.data?.email ??
    "";
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email.trim()) {
      Alert.alert(
        "이메일이 필요해요",
        "가입할 때 쓴 이메일을 알고 있으면 다시 가입 화면에서 보내 주세요.",
      );
      return;
    }

    try {
      await requestVerificationMutation.mutateAsync(email.trim());
      setResent(true);
      Alert.alert(
        "메일을 다시 보냈어요",
        "받은편지함과 스팸함도 살짝 살펴봐 주세요.",
      );
    } catch (error) {
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        error instanceof Error
          ? error.message
          : "메일을 다시 보내지 못했어요. 조금 뒤에 다시 해볼까요?",
      );
    }
  };

  return (
    <Screen
      title="메일을 보냈어요"
      subtitle="링크를 누르면 가입이 끝나요."
      footer={
        <View style={styles.footer}>
          <Button
            onPress={() => void handleResend()}
            fullWidth
            loading={requestVerificationMutation.isPending}
          >
            {resent ? "인증 메일 한 번 더 보낼게요" : "인증 메일 다시 보내기"}
          </Button>
          <Pressable
            onPress={() => router.replace("/auth/login")}
            style={styles.secondaryLink}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLinkText}>로그인 화면으로</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.content}>
        <Mascot size="large" mood="happy" />
        <Text style={styles.headline}>메일함을 열어볼까요?</Text>
        <Text style={styles.body}>
          {email
            ? `${email} 으로 확인 메일을 보내 뒀어요. 링크를 누르면 바로 시작할 수 있어요.`
            : "확인 메일을 보내 뒀어요. 링크를 누르면 바로 시작할 수 있어요."}
        </Text>
        <Text style={styles.hint}>
          메일이 안 보이면 스팸함도 한번 살펴봐 주세요.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  headline: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.fontWeight,
    color: colors.subtext,
    textAlign: "center",
  },
  hint: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.mutedText,
    textAlign: "center",
  },
  footer: {
    gap: spacing.sm,
  },
  secondaryLink: {
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLinkText: {
    fontSize: typography.body.fontSize,
    fontWeight: "600",
    color: colors.primary,
  },
});
