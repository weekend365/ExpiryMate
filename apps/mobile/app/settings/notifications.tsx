import {
  DEFAULT_NOTIFICATION_DAYS,
  DEFAULT_QUIET_HOURS,
  updateNotificationPreferenceSchema,
  type UpdateNotificationPreference,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Building2, House, Users } from "lucide-react-native";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { FormField } from "../../src/components/FormField";
import { ListRow } from "../../src/components/ListRow";
import { Pill } from "../../src/components/Pill";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useNotificationPreferences } from "../../src/features/settings/use-notification-preferences";
import { spaceNotificationStatusCopy } from "../../src/features/spaces/space-notification-copy";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { useUpdateSpaceNotifications } from "../../src/features/spaces/use-space-notifications";
import { useDeviceNotificationStatus } from "../../src/features/notifications/use-device-notification-status";
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
  const device = useDeviceNotificationStatus();
  const form = useForm<UpdateNotificationPreference>({
    resolver: zodResolver(updateNotificationPreferenceSchema),
    defaultValues: {
      enabled: true,
      remindOnDayOf: true,
      reminderDaysBefore: DEFAULT_NOTIFICATION_DAYS,
      deliveryTime: "09:00",
      groupBySpace: true,
      quietHoursStart: DEFAULT_QUIET_HOURS.start,
      quietHoursEnd: DEFAULT_QUIET_HOURS.end,
    },
  });
  const enabled = form.watch("enabled") ?? true;
  const remindOnDayOf = form.watch("remindOnDayOf") ?? true;
  const days = form.watch("reminderDaysBefore") ?? [];
  const groupBySpace = form.watch("groupBySpace") ?? true;
  const busy = mutation.isPending || device.connect.isPending;
  const connection = device.query.data;

  useEffect(() => {
    if (query.data && !form.formState.isDirty) {
      form.reset(query.data);
    }
  }, [query.data, form]);

  const toggleDay = (value: number) => {
    form.setValue(
      "reminderDaysBefore",
      days.includes(value)
        ? days.filter((item) => item !== value)
        : [...days, value].sort((left, right) => left - right),
      { shouldDirty: true },
    );
  };

  const handleSave = form.handleSubmit(async (values) => {
    const status = values.enabled
      ? await device.connect
          .mutateAsync()
          .catch(() => "connection_error" as const)
      : connection;
    try {
      const saved = await mutation.mutateAsync(values);
      form.reset(saved);
      Alert.alert(
        "알림 설정을 저장했어요",
        !values.enabled
          ? "기한 알림을 꺼두었어요."
          : status === "connected"
            ? "이 기기의 알림 연결을 확인했어요. 냉장고별 알림 설정도 함께 적용돼요."
            : "설정은 저장했지만 이 기기의 알림 수신 준비가 끝나지 않았어요. 아래 연결 상태를 확인해 주세요.",
      );
    } catch (error) {
      Alert.alert("설정을 저장하지 못했어요", getSettingsErrorMessage(error));
    }
  });

  return (
    <SettingsScreen
      footer={
        <Button
          onPress={() => void handleSave()}
          loading={busy}
          disabled={!query.data || query.isError}
          fullWidth
        >
          알림 설정 저장
        </Button>
      }
    >
      {query.isLoading ? (
        <ActivityIndicator accessibilityLabel="알림 설정 불러오는 중" />
      ) : null}
      {query.isError ? (
        <EmptyState
          kind="error"
          title="알림 설정을 불러오지 못했어요"
          description={getSettingsErrorMessage(query.error)}
          actionLabel="다시 시도"
          onAction={() => void query.refetch()}
        />
      ) : null}
      <FeedbackBanner
        testID="notification-device-status"
        tone={connection === "connected" ? "success" : "warning"}
        title={
          device.query.isFetching || device.connect.isPending
            ? "기기 알림 연결 확인 중"
            : device.query.isError || connection === "connection_error"
              ? "알림 연결을 확인하지 못했어요"
              : connection === "connected"
                ? "기기 권한 허용 · 알림 연결 확인됨"
                : connection === "blocked"
                  ? "기기에서 알림을 차단하고 있어요"
                  : "기기 알림 권한이 필요해요"
        }
        description={
          connection === "connected"
            ? "앱의 알림 받기와 냉장고별 알림이 켜져 있어야 해요. 실제 표시 여부는 기기의 집중 모드와 네트워크 상태에 따라 달라질 수 있어요."
            : "앱 설정 저장과 기기의 알림 수신 준비는 별개예요."
        }
        actionLabel={connection === "blocked" ? "기기 설정 열기" : "연결 확인"}
        onAction={
          busy || device.query.isFetching
            ? undefined
            : () => {
                if (connection === "blocked") {
                  void Linking.openSettings().catch(() =>
                    Alert.alert(
                      "기기 설정을 열지 못했어요",
                      "기기 설정에서 장고의 알림을 허용해 주세요.",
                    ),
                  );
                } else {
                  device.connect.mutate();
                }
              }
        }
      />
      <SettingsGroup title="알림">
        <ListRow
          title="알림 받기"
          description="만료 전과 당일 알림을 받을 수 있어요."
          trailing={
            <Switch
              value={enabled}
              onValueChange={(value) =>
                form.setValue("enabled", value, { shouldDirty: true })
              }
              accessibilityLabel="알림 받기"
              trackColor={{
                false: colors.border,
                true: colors.primarySoft,
              }}
              thumbColor={
                enabled ? colors.actionPrimaryBackground : colors.mutedSurface
              }
            />
          }
        />
        <ListRow
          title="냉장고별로 묶어서 받기"
          description="같은 날 확인할 재료를 냉장고마다 한 번에 알려드려요."
          last
          trailing={
            <Switch
              value={groupBySpace}
              onValueChange={(value) =>
                form.setValue("groupBySpace", value, { shouldDirty: true })
              }
              accessibilityLabel="냉장고별로 묶어서 받기"
              trackColor={{
                false: colors.border,
                true: colors.primarySoft,
              }}
              thumbColor={
                groupBySpace
                  ? colors.actionPrimaryBackground
                  : colors.mutedSurface
              }
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
                        ? colors.actionPrimaryBackground
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
              label={value === 0 ? "당일" : `${value}일 전`}
              selected={value === 0 ? remindOnDayOf : days.includes(value)}
              onPress={() =>
                value === 0
                  ? form.setValue("remindOnDayOf", !remindOnDayOf, {
                      shouldDirty: true,
                    })
                  : toggleDay(value)
              }
            />
          ))}
        </View>
      </SettingsGroup>
      <SettingsGroup
        title="받을 시간"
        description="한국 시간 기준이에요. 선택한 시간 이후 다음 알림 점검 때 보내므로 조금 늦어질 수 있어요."
        content="padded"
      >
        <FormField
          control={form.control}
          name="deliveryTime"
          label="알림 시간 (24시간제)"
          placeholder="09:00"
        />
      </SettingsGroup>
      <SettingsGroup
        title="방해 금지 시간"
        description="이 시간에는 알림을 보내지 않아요. 받을 시간은 이 구간 밖으로 골라 주세요. 시작과 종료가 같으면 방해 금지를 사용하지 않아요."
        content="padded"
      >
        <View style={styles.timeFields}>
          <FormField
            control={form.control}
            name="quietHoursStart"
            label="시작 시간"
            placeholder="22:00"
          />
          <FormField
            control={form.control}
            name="quietHoursEnd"
            label="종료 시간"
            placeholder="07:00"
          />
        </View>
      </SettingsGroup>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  timeFields: { gap: spacing.sm },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
