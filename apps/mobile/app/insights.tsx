import {
  productCategoryLabels,
  type InsightWindowDays,
  type PlusInsights,
  type ProductCategory,
} from "@expirymate/shared";
import { router } from "expo-router";
import { Lightbulb, Sparkles, Warehouse } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { Button } from "../src/components/Button";
import { SkeletonBlock } from "../src/components/ContentSkeleton";
import { Screen } from "../src/components/Screen";
import {
  useInsightsOverview,
  useInsightsPreview,
} from "../src/features/insights/use-insights";
import { useSubscriptionEntitlement } from "../src/features/subscriptions/use-subscription-entitlement";
import { colors, radius, spacing } from "../src/shared/theme";

export default function InsightsScreen() {
  const entitlement = useSubscriptionEntitlement();
  const hasPlus = Boolean(
    entitlement.query.data?.hasActiveEntitlement &&
      entitlement.query.data.planCode === "jango_plus",
  );
  const preview = useInsightsPreview();
  const [windowDays, setWindowDays] = useState<InsightWindowDays>(30);
  const overview = useInsightsOverview(windowDays, hasPlus);

  if (preview.isLoading || entitlement.query.isLoading) {
    return (
      <Screen scroll contentWidth="form">
        <SkeletonBlock height={180} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentWidth="form" contentStyle={styles.screen}>
      <View style={styles.intro}>
        <AppText variant="heading">버린 재료를 다음 행동으로 바꿔요</AppText>
        <AppText variant="bodySmall" tone="subtext">
          현재 선택한 냉장고에서 소비·폐기로 마친 기록만 집계합니다.
        </AppText>
      </View>

      {!hasPlus ? (
        <View style={styles.card}>
          <AppText variant="bodyStrong">최근 30일 미리보기</AppText>
          <View style={styles.metrics}>
            <Metric label="소비" value={preview.data?.consumed ?? 0} suffix="개" />
            <Metric label="폐기" value={preview.data?.discarded ?? 0} suffix="개" />
          </View>
          <AppText variant="caption" tone="subtext">
            {preview.data?.ready
              ? "기록이 충분히 쌓였어요. 플러스에서 폐기율, 주간 비교, 90일 추세와 실천 제안을 확인할 수 있어요."
              : `리포트 준비까지 ${Math.max(0, 5 - (preview.data?.resolved ?? 0))}개의 소비·폐기 기록이 더 필요해요.`}
          </AppText>
          <Button
            fullWidth
            onPress={() => router.push("/settings/subscription")}
          >
            장고 플러스 살펴보기
          </Button>
        </View>
      ) : (
        <>
          <View style={styles.segment}>
            {([30, 90] as const).map((days) => (
              <Pressable
                key={days}
                accessibilityRole="radio"
                accessibilityState={{ selected: windowDays === days }}
                onPress={() => setWindowDays(days)}
                style={[
                  styles.segmentButton,
                  windowDays === days && styles.segmentButtonActive,
                ]}
              >
                <AppText
                  variant="bodySmallStrong"
                  tone={windowDays === days ? "primary" : "subtext"}
                >
                  {days}일
                </AppText>
              </Pressable>
            ))}
          </View>

          {overview.isLoading ? <SkeletonBlock height={240} /> : null}
          {overview.data ? (
            <>
              <View style={styles.metrics}>
                <Metric label="소비 완료" value={overview.data.consumed} suffix="개" />
                <Metric label="폐기" value={overview.data.discarded} suffix="개" />
                <Metric label="폐기율" value={overview.data.wasteRatePercent} suffix="%" />
                <Metric label="7일 내 임박" value={overview.data.expiringSoon} suffix="개" />
              </View>
              <WeeklyCard weekly={overview.data.weekly} />
              <View style={styles.card}>
                <AppText variant="bodyStrong">이번 주 장고 브리핑</AppText>
                {overview.data.actions.length ? (
                  overview.data.actions.map((action) => (
                    <ActionRow key={action.kind} action={action} />
                  ))
                ) : (
                  <AppText variant="bodySmall" tone="subtext">
                    지금은 급한 행동이 없어요. 기록이 더 쌓이면 우선순위를 정해드릴게요.
                  </AppText>
                )}
              </View>
              {overview.data.topDiscardedCategories.length ? (
                <View style={styles.card}>
                  <AppText variant="bodyStrong">자주 버린 분류</AppText>
                  <AppText variant="bodySmall" tone="subtext">
                    {overview.data.topDiscardedCategories
                      .map(
                        (item) =>
                          `${productCategoryLabels[item.category as ProductCategory] ?? item.category} ${item.count}개`,
                      )
                      .join(" · ")}
                  </AppText>
                </View>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <View style={styles.metric}>
      <AppText variant="title">
        {value}
        {suffix}
      </AppText>
      <AppText variant="caption" tone="subtext">
        {label}
      </AppText>
    </View>
  );
}

function WeeklyCard({ weekly }: { weekly: PlusInsights["weekly"] }) {
  const change = weekly.wasteRateChangePercentagePoints;
  const message =
    weekly.trend === "improved"
      ? `지난주보다 폐기율이 ${Math.abs(change ?? 0)}%p 줄었어요.`
      : weekly.trend === "worse"
        ? `지난주보다 폐기율이 ${Math.abs(change ?? 0)}%p 늘었어요.`
        : weekly.trend === "steady"
          ? "지난주와 비슷한 흐름이에요."
          : "2주간 기록이 쌓이면 변화를 비교해 드릴게요.";
  return (
    <View style={styles.highlightCard}>
      <AppText variant="bodyStrong">주간 비교</AppText>
      <AppText variant="bodySmall">
        이번 주 소비 {weekly.current.consumed}개 · 폐기 {weekly.current.discarded}개
      </AppText>
      <AppText
        variant="caption"
        tone={
          weekly.trend === "improved"
            ? "success"
            : weekly.trend === "worse"
              ? "danger"
              : "subtext"
        }
      >
        {message}
      </AppText>
    </View>
  );
}

function ActionRow({ action }: { action: PlusInsights["actions"][number] }) {
  const isExpiring = action.kind === "use_expiring";
  const title = isExpiring
    ? `임박 재료 ${action.count}개로 추천받기`
    : action.kind === "reduce_category_waste"
      ? `${productCategoryLabels[action.category as ProductCategory] ?? action.category ?? "재고"} 구매량 점검하기`
      : action.kind === "review_waste_trend"
        ? "이번 주 폐기 원인 돌아보기"
        : "좋아진 소비 흐름 이어가기";
  return (
    <Pressable
      onPress={() =>
        router.push(
          isExpiring ? "/(tabs)/recommendations" : "/(tabs)/inventory",
        )
      }
      style={styles.action}
    >
      <View style={styles.actionIcon}>
        {isExpiring ? (
          <Sparkles color={colors.primary} size={18} />
        ) : action.kind === "reduce_category_waste" ? (
          <Warehouse color={colors.primary} size={18} />
        ) : (
          <Lightbulb color={colors.primary} size={18} />
        )}
      </View>
      <View style={styles.actionCopy}>
        <AppText variant="bodySmallStrong">{title}</AppText>
        {action.itemNames.length ? (
          <AppText variant="caption" tone="subtext">
            {action.itemNames.join(", ")}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md, paddingBottom: spacing.xxxl },
  intro: { gap: spacing.xs },
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  highlightCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
  },
  segment: {
    flexDirection: "row",
    padding: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  segmentButtonActive: { backgroundColor: colors.surface },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: {
    width: "48%",
    gap: spacing.xxs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  actionIcon: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  actionCopy: { flex: 1, gap: spacing.xxs },
});
