import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { ExternalLink, ShieldCheck, Trash2 } from "lucide-react-native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { usePrivacyStatus } from "../../src/features/privacy/use-privacy";
import { colors, spacing } from "../../src/shared/theme";

export default function PrivacyScreen() {
  const privacyStatusQuery = usePrivacyStatus();
  const status = privacyStatusQuery.data;

  const openPolicy = () => {
    if (!status?.privacyPolicyUrl) {
      Alert.alert("준비 중", "개인정보처리방침 URL을 불러오는 중이에요.");
      return;
    }

    WebBrowser.openBrowserAsync(status.privacyPolicyUrl).catch(() =>
      Alert.alert("열기 실패", "개인정보처리방침 URL을 열지 못했어요."),
    );
  };

  return (
    <Screen
      title="개인정보 및 AI 데이터"
      subtitle="ExpiryMate가 어떤 데이터를 쓰고, 어떻게 삭제할 수 있는지 확인해요."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>개인정보처리방침</Text>
        <Text style={styles.bodyText}>
          ExpiryMate는 계정, 재료와 유통기한, 알림 설정, AI 추천 히스토리를
          서비스 제공을 위해 사용해요. 자세한 공개 정책은 웹에서도 확인할 수
          있어요.
        </Text>
        <Button variant="secondary" icon={ExternalLink} onPress={openPolicy}>
          공개 정책 열기
        </Button>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI 추천 데이터 고지</Text>
        <Text style={styles.bodyText}>
          요리 추천을 요청하면 보관 중인 재료 일부와 추천 조건이 서버를 통해
          OpenAI API로 전송돼요. 첫 추천 전에 한 번 동의가 필요해요.
        </Text>
        <Button
          variant="secondary"
          icon={ShieldCheck}
          onPress={() => router.push("/privacy/ai-data-notice")}
        >
          AI 데이터 고지 보기
        </Button>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>계정 및 데이터 삭제</Text>
        <Text style={styles.bodyText}>
          삭제하면 재료, 추천 히스토리, 알림 설정, 로그인 세션과 연결 계정 정보가
          즉시 제거돼요.
        </Text>
        <Button
          variant="danger"
          icon={Trash2}
          onPress={() => router.push("/privacy/account-delete")}
        >
          계정 및 데이터 삭제
        </Button>
      </View>

      {status?.contactEmail ? (
        <Text style={styles.footerText}>문의: {status.contactEmail}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    color: colors.text,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.subtext,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.mutedText,
  },
});
