import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { EmailDomainInput } from "../../src/components/EmailDomainInput";
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

export default function ForgotPasswordScreen() {
  const { forgotPasswordMutation } = useAuth();
  const [email, setEmail] = useState("");

  const handleSubmit = async () => {
    try {
      await forgotPasswordMutation.mutateAsync(email);
      Alert.alert(
        "메일 보냈어요",
        "가입된 이메일이라면 비밀번호 재설정 메일을 보내드렸어요.",
      );
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    }
  };

  return (
    <Screen
      title="비밀번호를 잊었어요"
      subtitle="재설정 링크를 메일로 보내드릴게요."
      showBack
      footer={
        <Button
          onPress={handleSubmit}
          loading={forgotPasswordMutation.isPending}
          disabled={!email}
          fullWidth
        >
          재설정 메일 받을게요
        </Button>
      }
    >
      <View style={styles.hero}>
        <Mascot size="small" mood="idle" />
        <Text style={styles.heroText}>
          이메일만 알려주시면, 장고가 재설정 길을 안내할게요.
        </Text>
      </View>

      <Text style={styles.label}>이메일</Text>
      <EmailDomainInput
        value={email}
        onChangeText={setEmail}
        placeholder="아이디"
      />
    </Screen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  heroText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
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
    fontFamily: typography.body.fontFamily,
  },
});
