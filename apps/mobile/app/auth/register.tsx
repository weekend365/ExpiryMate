import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { colors, spacing } from "../../src/shared/theme";

export default function RegisterScreen() {
  const { registerMutation } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      await registerMutation.mutateAsync({
        email,
        password,
        displayName: displayName || undefined,
      });
      Alert.alert("가입 완료", "확인 메일을 보냈어요. 익명 재료는 계정으로 병합됐어요.");
      router.back();
    } catch (error) {
      Alert.alert("회원가입 실패", getErrorMessage(error));
    }
  };

  return (
    <Screen title="회원가입" subtitle="이메일 계정을 만들고 현재 등록한 재료를 이어서 사용해요.">
      <View style={styles.fieldGroup}>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="이름 또는 닉네임"
          style={styles.input}
        />
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
          placeholder="비밀번호 8자 이상"
          style={styles.input}
        />
      </View>
      <Button
        onPress={handleRegister}
        loading={registerMutation.isPending}
        disabled={!email || password.length < 8}
        fullWidth
      >
        가입하고 연결하기
      </Button>
    </Screen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
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
});
