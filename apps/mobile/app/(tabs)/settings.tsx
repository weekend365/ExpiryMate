import { DEFAULT_NOTIFICATION_DAYS } from "@expirymate/shared";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { ExternalLink, ShieldCheck, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { usePrivacyStatus } from "../../src/features/privacy/use-privacy";
import { useNotificationPreferences } from "../../src/features/settings/use-notification-preferences";
import { requestNotificationPermissions } from "../../src/services/notifications";
import { colors, spacing } from "../../src/shared/theme";

const reminderOptions = [0, 1, 3, 7, 14];

export default function SettingsScreen() {
  const auth = useAuth();
  const { query, mutation } = useNotificationPreferences();
  const privacyStatusQuery = usePrivacyStatus();
  const [enabled, setEnabled] = useState(true);
  const [remindOnDayOf, setRemindOnDayOf] = useState(true);
  const [days, setDays] = useState<number[]>(DEFAULT_NOTIFICATION_DAYS);

  useEffect(() => {
    if (query.data) {
      setEnabled(query.data.enabled);
      setRemindOnDayOf(query.data.remindOnDayOf);
      setDays(query.data.reminderDaysBefore);
    }
  }, [query.data]);

  const toggleDay = (value: number) => {
    setDays((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value].sort((left, right) => left - right),
    );
  };

  const handleSave = async () => {
    if (enabled) {
      const permission = await requestNotificationPermissions();
      if (!permission.granted) {
        Alert.alert("알림 권한이 필요해요", "기기 설정에서 알림을 허용해주세요.");
      }
    }

    mutation.mutate({
      enabled,
      remindOnDayOf,
      reminderDaysBefore: days.filter((value) => value > 0),
    });
  };

  const user = auth.query.data;
  const isRegistered = user?.accountType === "registered";
  const emailVerified = Boolean(user?.emailVerifiedAt);
  const privacyPolicyUrl = privacyStatusQuery.data?.privacyPolicyUrl;

  return (
    <Screen title="설정" subtitle="계정, 알림, 개인정보와 AI 데이터 사용을 관리해요.">
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>계정</Text>
            <Text style={styles.rowDescription}>
              {isRegistered
                ? `${user?.email ?? "연결된 계정"}${emailVerified ? "" : " · 이메일 미인증"}`
                : "익명으로 사용 중이에요. 로그인하면 현재 재료가 계정에 연결돼요."}
            </Text>
          </View>
        </View>
        {isRegistered ? (
          <View style={styles.actionRow}>
            {!emailVerified ? (
              <Button
                variant="secondary"
                size="small"
                onPress={() =>
                  auth.requestVerificationMutation.mutate(undefined, {
                    onSuccess: () => Alert.alert("메일 발송", "인증 메일을 보냈어요."),
                    onError: (error) => Alert.alert("요청 실패", getErrorMessage(error)),
                  })
                }
              >
                인증 메일
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="small"
              onPress={() =>
                auth.logoutMutation.mutate(undefined, {
                  onSuccess: () => Alert.alert("로그아웃", "로그아웃했어요."),
                })
              }
            >
              로그아웃
            </Button>
          </View>
        ) : (
          <Button
            variant="secondary"
            onPress={() => router.push("/auth/login")}
            fullWidth
          >
            로그인 또는 회원가입
          </Button>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>개인정보 및 AI 데이터</Text>
            <Text style={styles.rowDescription}>
              개인정보처리방침, AI 추천 데이터 사용, 계정 삭제를 확인할 수 있어요.
            </Text>
          </View>
        </View>
        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            size="small"
            icon={ShieldCheck}
            onPress={() => router.push("/privacy")}
          >
            개인정보처리방침
          </Button>
          <Button
            variant="secondary"
            size="small"
            icon={ShieldCheck}
            onPress={() => router.push("/privacy/ai-data-notice")}
          >
            AI 데이터 고지
          </Button>
          <Button
            variant="danger"
            size="small"
            icon={Trash2}
            onPress={() => router.push("/privacy/account-delete")}
          >
            데이터 삭제
          </Button>
          {privacyPolicyUrl ? (
            <Button
              variant="secondary"
              size="small"
              icon={ExternalLink}
              onPress={() => {
                WebBrowser.openBrowserAsync(privacyPolicyUrl).catch(() =>
                  Alert.alert("열기 실패", "개인정보처리방침 URL을 열지 못했어요."),
                );
              }}
            >
              웹에서 보기
            </Button>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>알림 받기</Text>
            <Text style={styles.rowDescription}>
              만료 전과 당일 알림을 받을 수 있어요.
            </Text>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>당일 알림</Text>
            <Text style={styles.rowDescription}>오늘 만료되는 상품을 다시 알려드려요.</Text>
          </View>
          <Switch value={remindOnDayOf} onValueChange={setRemindOnDayOf} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>리마인드 시점</Text>
        <View style={styles.pillRow}>
          {reminderOptions.map((value) => (
            <Pill
              key={value}
              label={value === 0 ? "오늘" : `${value}일 전`}
              selected={value === 0 ? remindOnDayOf : days.includes(value)}
              onPress={() => (value === 0 ? setRemindOnDayOf((current) => !current) : toggleDay(value))}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>앱 정보</Text>
        <Text style={styles.infoText}>ExpiryMate MVP · 한국어 우선 재고/유통기한 관리</Text>
        <Text style={styles.infoText}>푸시 알림과 OCR 인식은 아직 준비 중이에요.</Text>
      </View>

      <Button onPress={handleSave} loading={mutation.isPending}>
        저장
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  rowDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.subtext,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.subtext,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했어요.";
}
