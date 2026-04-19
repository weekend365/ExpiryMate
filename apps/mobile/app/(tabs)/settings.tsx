import { DEFAULT_NOTIFICATION_DAYS } from "@expirymate/shared";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { useNotificationPreferences } from "../../src/features/settings/use-notification-preferences";
import { requestNotificationPermissions } from "../../src/services/notifications";
import { colors, spacing } from "../../src/shared/theme";

const reminderOptions = [0, 1, 3, 7, 14];

export default function SettingsScreen() {
  const { query, mutation } = useNotificationPreferences();
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

  return (
    <Screen title="알림 설정" subtitle="유통기한 리마인더와 앱 기본 정보를 관리해요.">
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
});
