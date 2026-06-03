import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { verifyEmail } from "../../src/services/api";
import { colors, spacing } from "../../src/shared/theme";

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [message, setMessage] = useState("이메일을 인증하고 있어요.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setMessage("인증 링크가 올바르지 않아요.");
      setIsLoading(false);
      return;
    }

    verifyEmail(token)
      .then(() => setMessage("이메일 인증이 완료됐어요."))
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "인증에 실패했어요."),
      )
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <Screen title="이메일 인증">
      <View style={styles.panel}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
      <Button onPress={() => router.replace("/(tabs)/settings")} fullWidth>
        설정으로 이동
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  message: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
});
