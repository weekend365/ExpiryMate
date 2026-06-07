import { router } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { useDeleteAccount } from "../../src/features/privacy/use-privacy";
import { colors, spacing } from "../../src/shared/theme";

export default function AccountDeleteScreen() {
  const deleteAccountMutation = useDeleteAccount();
  const [confirmation, setConfirmation] = useState("");
  const canDelete = confirmation.trim() === "삭제";

  const handleDelete = () => {
    if (!canDelete) {
      return;
    }

    deleteAccountMutation.mutate(
      { confirmation: "삭제" },
      {
        onSuccess: () => {
          Alert.alert("삭제 완료", "계정과 데이터가 삭제됐어요.");
          router.replace("/");
        },
        onError: (error) => Alert.alert("삭제 실패", getErrorMessage(error)),
      },
    );
  };

  return (
    <Screen
      title="계정 및 데이터 삭제"
      subtitle="삭제하면 되돌릴 수 없어요. 필요한 정보를 먼저 확인해 주세요."
    >
      <View style={styles.warningCard}>
        <Trash2 color={colors.danger} size={28} strokeWidth={2.5} />
        <View style={styles.warningCopy}>
          <Text style={styles.warningTitle}>즉시 삭제되는 데이터</Text>
          <Text style={styles.warningText}>
            재료와 유통기한, AI 추천 히스토리, 알림 설정, 로그인 세션, 이메일
            비밀번호 또는 소셜 로그인 연결 정보가 삭제돼요.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>삭제 확인</Text>
        <Text style={styles.bodyText}>
          계속하려면 아래 입력칸에 `삭제`를 입력해 주세요.
        </Text>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="삭제"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholderTextColor={colors.mutedText}
        />
      </View>

      <Button
        variant="danger"
        icon={Trash2}
        disabled={!canDelete}
        loading={deleteAccountMutation.isPending}
        onPress={handleDelete}
      >
        계정 및 데이터 삭제
      </Button>
    </Screen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
}

const styles = StyleSheet.create({
  warningCard: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 16,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  warningCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  warningTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.danger,
  },
  warningText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.text,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.subtext,
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
});
