import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { resetPassword } from "../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert(
        "앗, 링크가 이상해요",
        "재설정 링크가 올바르지 않아요. 메일을 다시 확인해 주세요.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword(token, password);
      Alert.alert("비밀번호를 바꿨어요", "새 비밀번호로 다시 들어와 주세요.");
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      title="비밀번호 다시 정하기"
      subtitle="새 비밀번호를 입력해 주세요."
      footer={
        <Button
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={password.length < 8}
          fullWidth
        >
          이 비밀번호로 할게요
        </Button>
      }
    >
      <View style={styles.hero}>
        <Mascot size="small" mood="idle" />
        <Text style={styles.heroText}>
          8자 이상으로 정해주시면, 장고가 안전하게 기억해 둘게요.
        </Text>
      </View>

      <Text style={styles.label}>새 비밀번호</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="비밀번호 8자 이상"
        placeholderTextColor={colors.mutedText}
        style={styles.input}
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
    color: colors.subtext,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.label.fontWeight,
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
    fontWeight: typography.body.fontWeight,
  },
});
