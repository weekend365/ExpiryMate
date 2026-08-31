import { DEFAULT_NOTIFICATION_DAYS } from "@expirymate/shared";
import { Building2, House, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { ListRow } from "../../src/components/ListRow";
import { Pill } from "../../src/components/Pill";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useNotificationPreferences } from "../../src/features/settings/use-notification-preferences";
import { spaceNotificationStatusCopy } from "../../src/features/spaces/space-notification-copy";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { useUpdateSpaceNotifications } from "../../src/features/spaces/use-space-notifications";
import { registerDevicePushToken } from "../../src/services/notifications";
import { colors, spacing } from "../../src/shared/theme";

const reminderOptions = [0, 1, 3, 7, 14];

export default function NotificationSettingsScreen() {
  const { query, mutation } = useNotificationPreferences();
  const {
    spaces,
    error: spacesError,
    isLoading: spacesLoading,
    refetchSpaces,
  } = useActiveSpace();
  const spaceNotificationsMutation = useUpdateSpaceNotifications();
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
    <SettingsScreen
      footer={
        <Button onPress={handleSave} loading={mutation.isPending} fullWidth>
          알림 설정 저장
        </Button>
      }
    >
      <SettingsGroup title="알림">
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
      </SettingsGroup>

      {spacesError ? (
        <EmptyState
          kind="error"
          mood="worry"
          title="냉장고 알림을 불러오지 못했어요"
          description={spacesError.message}
          actionLabel="다시 시도"
          onAction={() => {
            void refetchSpaces();
          }}
        />
      ) : !spacesLoading && spaces.length ? (
        <SettingsGroup
          title="냉장고별 알림"
          description="알림이 안 오면 이 냉장고만 쉬고 있는지 확인해 보세요."
        >
          {spaces.map((space, index) => {
            const Icon =
              space.type === "store"
                ? Building2
                : space.type === "household"
                  ? Users
                  : House;
            return (
              <ListRow
                key={space.id}
                title={space.name}
                description={spaceNotificationStatusCopy(
                  space.notificationsEnabled,
                )}
                icon={Icon}
                last={index === spaces.length - 1}
                trailing={
                  <Switch
                    value={space.notificationsEnabled}
                    disabled={spaceNotificationsMutation.isPending}
                    onValueChange={(value) =>
                      spaceNotificationsMutation.mutate(
                        { spaceId: space.id, enabled: value },
                        {
                          onError: (error) =>
                            Alert.alert(
                              "앗, 잠시 문제가 생겼어요",
                              getSettingsErrorMessage(error),
                            ),
                        },
                      )
                    }
                    accessibilityLabel={`${space.name} 유통기한 알림`}
                    trackColor={{
                      false: colors.border,
                      true: colors.primarySoft,
                    }}
                    thumbColor={
                      space.notificationsEnabled
                        ? colors.primary
                        : colors.mutedSurface
                    }
                  />
                }
              />
            );
          })}
        </SettingsGroup>
      ) : null}

      <SettingsGroup
        title="알림 시점"
        description="장고가 미리 챙길 시점을 골라 주세요."
        content="padded"
      >
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
      </SettingsGroup>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
