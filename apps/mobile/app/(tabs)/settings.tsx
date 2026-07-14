import { DEFAULT_NOTIFICATION_DAYS, appBrand } from "@expirymate/shared";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import {
  ChevronRight,
  CreditCard,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { useAuth } from "../../src/features/auth/use-auth";
import { usePrivacyStatus } from "../../src/features/privacy/use-privacy";
import { useNotificationPreferences } from "../../src/features/settings/use-notification-preferences";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { registerDevicePushToken } from "../../src/services/notifications";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

const reminderOptions = [0, 1, 3, 7, 14];

export default function SettingsScreen() {
  const auth = useAuth();
  const { query, mutation } = useNotificationPreferences();
  const privacyStatusQuery = usePrivacyStatus();
  const subscription = useSubscriptionEntitlement();
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
          Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error)),
      },
    );
  };

  const user = auth.query.data;
  const isRegistered = user?.accountType === "registered";
  const emailVerified = Boolean(user?.emailVerifiedAt);
  const privacyPolicyUrl = privacyStatusQuery.data?.privacyPolicyUrl;
  const entitlement = subscription.query.data;
  const hasActiveEntitlement = Boolean(entitlement?.hasActiveEntitlement);
  const refreshSubscription = () => {
    subscription.query.refetch().catch(() =>
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        "구독 상태를 아직 못 불러왔어요.",
      ),
    );
  };

  return (
    <Screen
      title="설정"
      subtitle="계정과 알림을 장고랑 맞춰볼까요?"
      footer={
        <Button onPress={handleSave} loading={mutation.isPending} fullWidth>
          알림 타이밍 맞춰둘게요
        </Button>
      }
    >
      <View style={styles.brandCard}>
        <Mascot size="small" mood="idle" />
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>{appBrand.appNameKo}</Text>
          <Text style={styles.brandMeta}>
            {appBrand.appNameEn} · {appBrand.productLineKo}
          </Text>
          <Text style={styles.brandNote}>
            OCR 인식은 아직 준비 중이에요. 지금은 직접 넣어주시면 돼요.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="계정" description="계정으로 이어가면 재료를 안전하게 지킬 수 있어요." />
        <View style={styles.card}>
          <ListRow
            title={isRegistered ? "내 계정" : "익명으로 사용 중이에요"}
            description={
              isRegistered
                ? `${user?.email ?? "연결된 계정"}${
                    !emailVerified && user?.email
                      ? " · 메일 확인이 필요해요"
                      : ""
                  }`
                : "이어가면 지금 넣은 재료가 계정에 연결돼요."
            }
            onPress={
              isRegistered ? undefined : () => router.push("/auth/login")
            }
          />
          {isRegistered ? (
            <>
              {!emailVerified && user?.email ? (
                <ListRow
                  title="인증 메일 다시 받을게요"
                  description="메일함에서 인증만 마쳐 주세요."
                  icon={Mail}
                  onPress={() =>
                    auth.requestVerificationMutation.mutate(undefined, {
                      onSuccess: () =>
                        Alert.alert(
                          "메일을 보냈어요",
                          "메일함에서 인증만 마쳐 주세요. 장고가 기다리고 있어요.",
                        ),
                      onError: (error) =>
                        Alert.alert(
                          "앗, 잠시 문제가 생겼어요",
                          getErrorMessage(error),
                        ),
                    })
                  }
                />
              ) : null}
              <ListRow
                title="로그아웃"
                description="이 기기에서 잠시 나갈게요."
                icon={LogOut}
                onPress={() =>
                  auth.logoutMutation.mutate(undefined, {
                    onSuccess: () =>
                      Alert.alert("다음에 또 만나요", "이 기기에서 나갔어요."),
                  })
                }
              />
            </>
          ) : (
            <ListRow
              title="계정으로 이어가기"
              description="카카오·네이버 등으로 이어서 쓸 수 있어요."
              onPress={() => router.push("/auth/login")}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="구독" description="추천 한도와 혜택을 살펴볼 수 있어요." />
        <View style={styles.card}>
          <ListRow
            title={hasActiveEntitlement ? "구독이 켜져 있어요" : "아직 구독이 없어요"}
            description={
              subscription.query.isLoading
                ? "구독 상태를 불러오고 있어요."
                : hasActiveEntitlement
                  ? `${formatStore(entitlement?.store)} · ${formatExpiry(entitlement?.expiresAt)}까지`
                  : "스토어 반영이 늦을 때 다시 불러와 보세요."
            }
            icon={CreditCard}
            trailing={
              <View
                style={[
                  styles.statusChip,
                  hasActiveEntitlement
                    ? styles.statusChipOn
                    : styles.statusChipOff,
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    hasActiveEntitlement
                      ? styles.statusChipTextOn
                      : styles.statusChipTextOff,
                  ]}
                >
                  {hasActiveEntitlement ? "켜져 있어요" : "아직 없어요"}
                </Text>
              </View>
            }
          />
          <ListRow
            title="구독 상태 다시 불러오기"
            description="스토어 반영이 늦을 때 눌러 보세요."
            icon={RefreshCw}
            onPress={refreshSubscription}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="개인정보"
          description="어떤 정보를 쓰는지, 어떻게 지울 수 있는지 볼 수 있어요."
        />
        <View style={styles.card}>
          <ListRow
            title="개인정보처리방침"
            description="어떤 정보를 어떻게 지키는지 살펴볼 수 있어요."
            icon={ShieldCheck}
            onPress={() => router.push("/privacy")}
          />
          <ListRow
            title="AI 추천 안내"
            description="추천에 쓰이는 정보를 살펴볼 수 있어요."
            icon={ShieldCheck}
            onPress={() => router.push("/privacy/ai-data-notice")}
          />
          {privacyPolicyUrl ? (
            <ListRow
              title="웹에서 보기"
              description="브라우저로 개인정보처리방침을 열어요."
              icon={ExternalLink}
              onPress={() => {
                WebBrowser.openBrowserAsync(privacyPolicyUrl).catch(() =>
                  Alert.alert(
                    "앗, 잠시 문제가 생겼어요",
                    "개인정보처리방침 페이지를 열지 못했어요.",
                  ),
                );
              }}
            />
          ) : null}
          <ListRow
            title="계정과 데이터 정리"
            description="계정과 재료 기록을 정리할 수 있어요."
            icon={Trash2}
            destructive
            onPress={() => router.push("/privacy/account-delete")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="알림"
          description="유통기한이 다가오면 장고가 살짝 알려드릴게요."
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
          <View style={styles.reminderBlock}>
            <Text style={styles.reminderTitle}>언제 알려줄까요?</Text>
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

function ListRow({
  title,
  description,
  icon: Icon,
  trailing,
  onPress,
  destructive = false,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const content = (
    <>
      {Icon ? (
        <View
          style={[
            styles.listIcon,
            destructive && styles.listIconDanger,
          ]}
        >
          <Icon
            color={destructive ? colors.danger : colors.primary}
            size={spacing.sm + spacing.xxs}
            strokeWidth={2.4}
          />
        </View>
      ) : null}
      <View style={styles.listCopy}>
        <Text
          style={[styles.listTitle, destructive && styles.listTitleDanger]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={styles.listDescription}>{description}</Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <ChevronRight color={colors.mutedText} size={spacing.sm + spacing.xxs} />
        ) : null)}
    </>
  );

  if (!onPress) {
    return <View style={styles.listRow}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        pressed && styles.listRowPressed,
      ]}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  brandCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  brandName: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  brandMeta: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.primary,
  },
  brandNote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
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
    overflow: "hidden",
  },
  listRow: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  listIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  listIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  listCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  listTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
  listTitleDanger: {
    color: colors.danger,
  },
  listDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.subtext,
  },
  statusChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    minHeight: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipOn: {
    backgroundColor: colors.successSoft,
  },
  statusChipOff: {
    backgroundColor: colors.mutedSurface,
  },
  statusChipText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.label.fontWeight,
  },
  statusChipTextOn: {
    color: colors.success,
  },
  statusChipTextOff: {
    color: colors.mutedText,
  },
  reminderBlock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  reminderTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

function formatStore(store?: string | null) {
  if (store === "apple_app_store") {
    return "App Store";
  }

  if (store === "google_play") {
    return "Google Play";
  }

  return "스토어";
}

function formatExpiry(value?: string | null) {
  if (!value) {
    return "만료일을 아직 못 불러왔어요";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
