import { CreditCard, RefreshCw } from "lucide-react-native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { ListRow } from "../../src/components/ListRow";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  formatSubscriptionExpiry,
  formatSubscriptionStore,
} from "../../src/features/settings/settings-format";
import { useSubscriptionEntitlement } from "../../src/features/subscriptions/use-subscription-entitlement";
import { colors, radius, spacing, typography } from "../../src/shared/theme";

export default function SubscriptionSettingsScreen() {
  const subscription = useSubscriptionEntitlement();
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
      title="구독"
      subtitle="추천 한도와 혜택을 살펴볼 수 있어요."
    >
      <View style={styles.section}>
        <SectionHeader
          title="지금 상태"
          description="스토어 반영이 늦을 때 다시 불러와 보세요."
        />
        <View style={styles.card}>
          <ListRow
            title={
              hasActiveEntitlement ? "구독이 켜져 있어요" : "아직 구독이 없어요"
            }
            description={
              subscription.query.isLoading
                ? "구독 상태를 불러오고 있어요."
                : hasActiveEntitlement
                  ? `${formatSubscriptionStore(entitlement?.store)} · ${formatSubscriptionExpiry(entitlement?.expiresAt)}까지`
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
            last
            onPress={refreshSubscription}
          />
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
    fontFamily: typography.label.fontFamily,
  },
  statusChipTextOn: {
    color: colors.success,
  },
  statusChipTextOff: {
    color: colors.mutedText,
  },
});
