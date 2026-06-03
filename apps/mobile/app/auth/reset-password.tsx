import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, TextInput } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { resetPassword } from "../../src/services/api";
import { colors, spacing } from "../../src/shared/theme";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert("토큰 없음", "재설정 링크가 올바르지 않아요.");
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(token, password);
      Alert.alert("완료", "비밀번호를 다시 설정했어요.");
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert("재설정 실패", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen title="비밀번호 재설정" subtitle="새 비밀번호를 입력해주세요.">
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="비밀번호 8자 이상"
        style={styles.input}
      />
      <Button
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={password.length < 8}
        fullWidth
      >
        비밀번호 바꾸기
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
