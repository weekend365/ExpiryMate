import { useState } from "react";
import { Alert, StyleSheet, TextInput } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { colors, spacing } from "../../src/shared/theme";

export default function ForgotPasswordScreen() {
  const { forgotPasswordMutation } = useAuth();
  const [email, setEmail] = useState("");

  const handleSubmit = async () => {
    try {
      await forgotPasswordMutation.mutateAsync(email);
      Alert.alert("메일 발송", "가입된 이메일이면 비밀번호 재설정 메일을 받을 수 있어요.");
    } catch (error) {
      Alert.alert("요청 실패", getErrorMessage(error));
    }
  };

  return (
    <Screen title="비밀번호 찾기" subtitle="재설정 링크를 이메일로 보내드릴게요.">
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="이메일"
        style={styles.input}
      />
      <Button
        onPress={handleSubmit}
        loading={forgotPasswordMutation.isPending}
        disabled={!email}
        fullWidth
      >
        재설정 메일 받기
      </Button>
    </Screen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
}

const styles = StyleSheet.create({
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
});
