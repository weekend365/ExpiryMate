import { appBrand } from "@expirymate/shared";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
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
  const status = privacyStatusQuery.data;
  const accepted = Boolean(status?.hasAcceptedCurrentAiDataNotice);

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

  return (
    <Screen
      title="AI 추천 안내"
      subtitle={`${appBrand.characterNameKo}가 요리를 추천할 때 어떤 정보가 쓰이는지 알려드릴게요.`}
      footer={
        accepted ? undefined : (
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
              ? "현재 버전에 동의해 주셨어요"
              : "첫 추천 전에 한 번만 살펴봐 주세요"}
          </Text>
          <Text style={styles.statusDescription}>
            버전 {status?.aiDataNoticeVersion ?? "불러오는 중"}
            {status?.aiDataNoticeAcceptedAt
              ? ` · ${formatDate(status.aiDataNoticeAcceptedAt)}에 동의`
              : ""}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="자세히 알아보기" />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OpenAI API로 전송되는 데이터</Text>
          <Text style={styles.bodyText}>
            재료명, 카테고리, 수량과 단위, 보관 위치, 유통기한, 만료까지 남은
            일수, 인원·조리 시간·식사 유형 같은 추천 조건이 전송돼요.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>장고가 기억해 두는 것</Text>
          <Text style={styles.bodyText}>
            추천 요청 조건, 추천 당시 재료 snapshot, 생성된 요리 추천 결과는
            히스토리와 품질 개선을 위해 내 계정에 남겨 둬요.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>학습 사용 여부</Text>
          <Text style={styles.bodyText}>
            OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않아요. 다만
            서비스 보안과 abuse monitoring을 위해 일정 기간 보관될 수 있어요.
          </Text>
        </View>
      </View>
    </Screen>
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
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  statusDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
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
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  bodyText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
});
