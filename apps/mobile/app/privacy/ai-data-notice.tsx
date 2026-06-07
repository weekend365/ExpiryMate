import { CheckCircle2, ShieldCheck } from "lucide-react-native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import {
  useAcceptAiDataNotice,
  usePrivacyStatus,
} from "../../src/features/privacy/use-privacy";
import { colors, spacing } from "../../src/shared/theme";

export default function AiDataNoticeScreen() {
  const privacyStatusQuery = usePrivacyStatus();
  const acceptMutation = useAcceptAiDataNotice();
  const status = privacyStatusQuery.data;
  const accepted = Boolean(status?.hasAcceptedCurrentAiDataNotice);

  const handleAccept = () => {
    acceptMutation.mutate(undefined, {
      onSuccess: () => Alert.alert("동의 완료", "AI 추천을 사용할 수 있어요."),
      onError: (error) => Alert.alert("요청 실패", getErrorMessage(error)),
    });
  };

  return (
    <Screen
      title="AI 데이터 고지"
      subtitle="요리 추천을 만들 때 어떤 데이터가 쓰이는지 확인해요."
    >
      <View style={styles.statusCard}>
        {accepted ? (
          <CheckCircle2 color={colors.success} size={24} strokeWidth={2.5} />
        ) : (
          <ShieldCheck color={colors.primary} size={24} strokeWidth={2.5} />
        )}
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>
            {accepted ? "현재 버전에 동의했어요" : "첫 추천 전에 동의가 필요해요"}
          </Text>
          <Text style={styles.statusDescription}>
            버전 {status?.aiDataNoticeVersion ?? "확인 중"}
            {status?.aiDataNoticeAcceptedAt
              ? ` · ${formatDate(status.aiDataNoticeAcceptedAt)} 동의`
              : ""}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>OpenAI API로 전송되는 데이터</Text>
        <Text style={styles.bodyText}>
          재료명, 카테고리, 수량과 단위, 보관 위치, 유통기한, 만료까지 남은
          일수, 인원·조리 시간·식사 유형 같은 추천 조건이 전송돼요.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>저장되는 데이터</Text>
        <Text style={styles.bodyText}>
          추천 요청 조건, 추천 당시 재료 snapshot, 생성된 요리 추천 결과는
          히스토리 확인과 품질 개선을 위해 내 계정에 저장돼요.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>학습 사용 여부</Text>
        <Text style={styles.bodyText}>
          OpenAI API 데이터는 기본적으로 모델 학습에 사용되지 않아요. 다만 서비스
          보안과 abuse monitoring을 위해 일정 기간 보관될 수 있어요.
        </Text>
      </View>

      {!accepted ? (
        <Button onPress={handleAccept} loading={acceptMutation.isPending}>
          동의하기
        </Button>
      ) : null}
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
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.text,
  },
  statusDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.subtext,
  },
});
