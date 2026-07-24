import { appBrand } from "@expirymate/shared";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
  useRevokeAiDataNotice,
} from "../../src/features/privacy/use-privacy";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../src/shared/theme";

export default function AiDataNoticeScreen() {
  const privacyStatusQuery = usePrivacyStatus();
  const acceptMutation = useAcceptAiDataNotice();
  const revokeMutation = useRevokeAiDataNotice();
  const status = privacyStatusQuery.data;
  const accepted = Boolean(status?.hasAcceptedCurrentAiDataNotice);
  const [revokeSheetOpen, setRevokeSheetOpen] = useState(false);

  const handleAccept = () => {
    acceptMutation.mutate(undefined, {
      onSuccess: () =>
        Alert.alert(
          "동의해 주셔서 감사해요",
          "이제 요리 추천을 부탁하실 수 있어요.",
        ),
      onError: (error) =>
        Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error)),
    });
  };

  const handleRevoke = () => {
    revokeMutation.mutate(undefined, {
      onSuccess: () => {
        setRevokeSheetOpen(false);
        Alert.alert(
          "동의를 거뒀어요",
          "이제 새 추천을 부탁하면 다시 안내를 살펴보게 돼요. 이미 받아 두신 추천은 「받은 추천 기록 정리」에서 지울 수 있어요.",
        );
      },
      onError: (error) => {
        setRevokeSheetOpen(false);
        Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
      },
    });
  };

  return (
    <>
      <Screen
        title="요리 추천 안내"
        subtitle={`${appBrand.characterNameKo}가 요리를 추천할 때 어떤 정보가 쓰이는지 알려드릴게요.`}
        footer={
          accepted ? (
            <Button
              variant="secondary"
              onPress={() => setRevokeSheetOpen(true)}
              fullWidth
            >
              추천 동의를 거둘게요
            </Button>
          ) : (
            <Button
              onPress={handleAccept}
              loading={acceptMutation.isPending}
              fullWidth
            >
              내용을 살펴봤고 동의할게요
            </Button>
          )
        }
      >
        <View style={styles.statusCard}>
          <Mascot size="small" mood={accepted ? "happy" : "idle"} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {accepted
                ? "안내를 살펴보시고 동의해 주셨어요"
                : "첫 추천 전에 한 번만 살펴봐 주세요"}
            </Text>
            <Text style={styles.statusDescription}>
              안내 버전 {status?.aiDataNoticeVersion ?? "불러오는 중"}
              {status?.aiDataNoticeAcceptedAt
                ? ` · ${formatDate(status.aiDataNoticeAcceptedAt)}에 동의`
                : ""}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="자세히 알아보기" />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>추천할 때 전달되는 정보</Text>
            <Text style={styles.bodyText}>
              재료 이름, 종류, 수량과 단위, 보관 위치, 유통기한, 만료까지 남은
              일수, 인원·조리 시간·식사 유형 같은 조건이 장고 서버를 거쳐 외부
              요리 도우미(OpenAI, 미국)로 전달돼요. 앱에는 OpenAI 키가 없어요.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>장고가 기억해 두는 것</Text>
            <Text style={styles.bodyText}>
              추천할 때 고른 조건, 그때의 재료 목록, 나온 요리 추천은 나중에 다시
              볼 수 있도록 내 계정에 남겨 둬요. 즐겨찾기에 저장한 요리도 같은
              계정에 남으며, 원하시면 「추천 기록과 즐겨찾기 정리」에서 언제든
              지울 수 있어요.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>얼마나 오래 두나요?</Text>
            <Text style={styles.bodyText}>
              장고 서버의 추천 기록은 직접 지우거나 계정을 정리할 때까지 보관해요.
              외부 도우미로 보낸 정보는 모델 학습에는 쓰이지 않고, 안전 확인을
              위해 그쪽 정책에 따라 최대 약 30일 보관될 수 있어요.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>동의를 거두면요?</Text>
            <Text style={styles.bodyText}>
              아래 버튼으로 동의를 거두면 새 추천 요청은 멈출 수 있어요. 이미 받아
              두신 추천은 그대로 남을 수 있으니, 필요하면 개인정보 화면에서 기록만
              따로 정리해 주세요.
            </Text>
          </View>
        </View>
      </Screen>

      <BottomSheet
        visible={revokeSheetOpen}
        onClose={() => setRevokeSheetOpen(false)}
        mascotMood="worry"
        title="추천 동의를 거둘까요?"
        description="거두면 새 요리 추천을 부탁할 때 다시 안내를 살펴보게 돼요. 이미 받아 두신 추천은 그대로 둘 수 있어요."
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={() => setRevokeSheetOpen(false)}
              fullWidth
            >
              조금 더 생각해 볼게요
            </Button>
            <Button
              variant="danger"
              onPress={handleRevoke}
              loading={revokeMutation.isPending}
              fullWidth
            >
              동의를 거둘게요
            </Button>
          </View>
        }
      />
    </>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  statusTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  statusDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  section: {
    gap: spacing.sm,
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
  sheetFooter: {
    gap: spacing.sm,
  },
});
