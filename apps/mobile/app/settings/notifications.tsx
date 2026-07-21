import { DEFAULT_NOTIFICATION_DAYS } from "@expirymate/shared";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../../src/components/Button";
import { ListRow } from "../../src/components/ListRow";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useNotificationPreferences } from "../../src/features/settings/use-notification-preferences";
import { registerDevicePushToken } from "../../src/services/notifications";
import { colors, radius, spacing, typography } from "../../src/shared/theme";

const reminderOptions = [0, 1, 3, 7, 14];

export default function NotificationSettingsScreen() {
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
      try {
        const pushToken = await registerDevicePushToken();

        if (!pushToken) {
          Alert.alert(
            "알림을 켜둘까요?",
            "기기 설정에서 알림을 허용해 주시면 장고가 알려드릴 수 있어요.",
          );
        }
      } catch {
        Alert.alert(
          "앗, 잠시 문제가 생겼어요",
          "알림 연결을 아직 못 했어요. 조금 뒤에 다시 해볼까요?",
        );
      }
    }

    mutation.mutate(
      {
        enabled,
        remindOnDayOf,
        reminderDaysBefore: days.filter((value) => value > 0),
      },
      {
        onSuccess: () =>
          Alert.alert("맞춰뒀어요", "알려줄 시점을 잘 기억해 둘게요."),
        onError: (error) =>
          Alert.alert(
            "앗, 잠시 문제가 생겼어요",
            getSettingsErrorMessage(error),
          ),
      },
    );
  };

  return (
    <Screen
      title="알림"
      subtitle="유통기한이 다가오면 장고가 살짝 알려드릴게요."
      footer={
        <Button onPress={handleSave} loading={mutation.isPending} fullWidth>
          알림 타이밍 맞춰둘게요
        </Button>
      }
    >
      <View style={styles.section}>
        <SectionHeader
          title="알려줄까요?"
          description="켜 두면 만료 전과 당일 알림을 받을 수 있어요."
        />
        <View style={styles.card}>
          <ListRow
            title="알림 받기"
            description="만료 전과 당일 알림을 받을 수 있어요."
            trailing={
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{
                  false: colors.border,
                  true: colors.primarySoft,
                }}
                thumbColor={enabled ? colors.primary : colors.mutedSurface}
              />
            }
          />
          <ListRow
            title="당일에도 알려주기"
            description="오늘 만료되는 재료를 한 번 더 알려드려요."
            last
            trailing={
              <Switch
                value={remindOnDayOf}
                onValueChange={setRemindOnDayOf}
                trackColor={{
                  false: colors.border,
                  true: colors.primarySoft,
                }}
                thumbColor={remindOnDayOf ? colors.primary : colors.mutedSurface}
              />
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="언제 알려줄까요?"
          description="장고가 미리 챙길 시점을 골라 주세요."
        />
        <View style={styles.card}>
          <View style={styles.reminderBlock}>
            <Text style={styles.reminderTitle}>알림 시점</Text>
            <View style={styles.pillRow}>
              {reminderOptions.map((value) => (
                <Pill
                  key={value}
                  label={value === 0 ? "오늘" : `${value}일 전`}
                  selected={value === 0 ? remindOnDayOf : days.includes(value)}
                  onPress={() =>
                    value === 0
                      ? setRemindOnDayOf((current) => !current)
                      : toggleDay(value)
                  }
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  reminderBlock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reminderTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
