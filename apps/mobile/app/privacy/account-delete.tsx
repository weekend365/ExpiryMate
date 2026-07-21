import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { useDeleteAccount } from "../../src/features/privacy/use-privacy";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

export default function AccountDeleteScreen() {
  const deleteAccountMutation = useDeleteAccount();
  const [confirmation, setConfirmation] = useState("");
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const canDelete = confirmation.trim() === "삭제";

  const handleDelete = () => {
    if (!canDelete) {
      return;
    }

    deleteAccountMutation.mutate(
      { confirmation: "삭제" },
      {
        onSuccess: () => {
          setConfirmSheetOpen(false);
          Alert.alert(
            "잘 보내드릴게요",
            "계정과 데이터를 정리했어요. 언제든 다시 와 주세요.",
          );
          router.replace("/");
        },
        onError: (error) => {
          setConfirmSheetOpen(false);
          Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
        },
      },
    );
  };

  return (
    <>
      <Screen
        title="계정과 데이터 정리"
        subtitle="정리하면 되돌릴 수 없어요. 천천히 확인해 주세요."
        footer={
          <Button
            variant="danger"
            disabled={!canDelete}
            onPress={() => setConfirmSheetOpen(true)}
            fullWidth
          >
            계정을 정리할게요
          </Button>
        }
      >
        <View style={styles.hero}>
          <Mascot size="medium" mood="worry" />
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {appBrand.characterNameKo}가 조금 걱정돼요
            </Text>
            <Text style={styles.heroText}>
              떠나셔도 괜찮아요. 다만 아래 정보는 바로 지워지니, 한 번만 더
              살펴봐 주세요.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>바로 지워지는 것들</Text>
          <Text style={styles.bodyText}>
            재료와 유통기한, AI 추천 히스토리, 알림 설정, 로그인 세션, 이메일
            비밀번호 또는 소셜 로그인 연결 정보가 지워져요.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>실수하지 않게 한 번 더</Text>
          <Text style={styles.bodyText}>
            계속하시려면 아래 칸에{" "}
            <Text style={styles.emphasis}>삭제</Text>를 입력해 주세요.
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
      </Screen>

      <BottomSheet
        visible={confirmSheetOpen}
        onClose={() => setConfirmSheetOpen(false)}
        mascotMood="worry"
        title="정말 계정을 정리할까요?"
        description={`${appBrand.appNameKo} 안의 재료와 기록이 모두 사라져요. 이 선택은 되돌릴 수 없어요.`}
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={() => setConfirmSheetOpen(false)}
              fullWidth
            >
              조금 더 생각해 볼게요
            </Button>
            <Button
              variant="danger"
              onPress={handleDelete}
              loading={deleteAccountMutation.isPending}
              fullWidth
            >
              네, 정리할게요
            </Button>
          </View>
        }
      >
        <View style={styles.confirmCard}>
          <Text style={styles.confirmLabel}>정리 대상</Text>
          <Text style={styles.confirmValue}>계정 · 재료 · 추천 · 알림 · 로그인</Text>
        </View>
      </BottomSheet>
    </>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  heroTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.danger,
  },
  heroText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  bodyText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  emphasis: {
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  input: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sheetFooter: {
    gap: spacing.sm,
  },
  confirmCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  confirmLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  confirmValue: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
});
