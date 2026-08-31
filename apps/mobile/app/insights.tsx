import {
  formatDateKorean,
  productCategoryLabels,
  type InsightPreview,
  type InsightWindowDays,
  type PlusInsights,
  type ProductCategory,
} from "@expirymate/shared";
import { router } from "expo-router";
import { Lightbulb, Sparkles, Warehouse } from "lucide-react-native";
import { useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { Button } from "../src/components/Button";
import { SkeletonBlock } from "../src/components/ContentSkeleton";
import { FeedbackBanner } from "../src/components/FeedbackBanner";
import { ListRow } from "../src/components/ListRow";
import { Screen } from "../src/components/Screen";
import { SectionHeader } from "../src/components/SectionHeader";
import { StatCard } from "../src/components/StatCard";
import { SurfaceCard } from "../src/components/SurfaceCard";
import {
  useInsightsOverview,
  useInsightsPreview,
} from "../src/features/insights/use-insights";
import { useSubscriptionEntitlement } from "../src/features/subscriptions/use-subscription-entitlement";
import { colors, radius, spacing, controlSize } from "../src/shared/theme";

type InsightAction = PlusInsights["actions"][number];
type InsightActionRoute =
  | "/(tabs)/recommendations"
  | "/(tabs)/inventory"
  | null;

export default function InsightsScreen() {
  const entitlement = useSubscriptionEntitlement();
  const preview = useInsightsPreview();
  const [windowDays, setWindowDays] = useState<InsightWindowDays>(30);
  const hasPlus = Boolean(
    entitlement.query.data?.hasActiveEntitlement &&
      entitlement.query.data.planCode === "jango_plus",
  );
  const overview = useInsightsOverview(windowDays, hasPlus);

  if (entitlement.query.isLoading && !entitlement.query.data) {
    return <InsightsSkeleton />;
  }

  if (entitlement.query.isError && !entitlement.query.data) {
    return (
      <InsightsErrorScreen
        title="구독 상태를 확인하지 못했어요"
        onRetry={() => {
          void entitlement.query.refetch();
        }}
      />
    );
  }

  if (!hasPlus && preview.isLoading && !preview.data) {
    return <InsightsSkeleton />;
  }

  return (
    <Screen
      scroll
      topInsetMode="none"
      contentWidth="form"
      contentStyle={styles.screen}
      testID="insights-screen"
    >
      <ReportIntro />

      {!hasPlus ? (
        <FreePreview
          preview={preview.data}
          isError={preview.isError}
          onRetry={() => {
            void preview.refetch();
          }}
        />
      ) : (
        <PlusReport
          windowDays={windowDays}
          onWindowChange={(days) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            setWindowDays(days);
          }}
          overview={overview}
        />
      )}
    </Screen>
  );
}

function InsightsSkeleton() {
  return (
    <Screen
      scroll
      topInsetMode="none"
      contentWidth="form"
      contentStyle={styles.screen}
      testID="insights-loading"
    >
      <SkeletonBlock height={spacing.xxl} width="72%" />
      <SkeletonBlock height={spacing.xxxl * 2} />
      <SkeletonBlock height={spacing.xxxl * 3} />
    </Screen>
  );
}

function InsightsErrorScreen({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  return (
    <Screen
      scroll
      topInsetMode="none"
      contentWidth="form"
      contentStyle={styles.screen}
      testID="insights-error"
    >
      <ReportIntro />
      <FeedbackBanner
        title={title}
        description="기록은 그대로 안전하게 보관되어 있어요. 연결을 확인한 뒤 다시 불러와 주세요."
        actionLabel="다시 시도"
        onAction={onRetry}
      />
    </Screen>
  );
}

function ReportIntro() {
  return (
    <View style={styles.intro}>
      <AppText variant="heading">버린 재료를 다음 행동으로 바꿔요</AppText>
      <AppText variant="bodySmall" tone="subtext">
        현재 선택한 냉장고에서 소비·폐기로 마친 기록만 집계합니다.
      </AppText>
    </View>
  );
}

function FreePreview({
  preview,
  isError,
  onRetry,
}: {
  preview: InsightPreview | undefined;
  isError: boolean;
  onRetry: () => void;
}) {
  if (!preview) {
    return (
      <FeedbackBanner
        title="최근 기록을 불러오지 못했어요"
        description="기록이 사라진 것은 아니에요. 잠시 후 다시 불러와 주세요."
        actionLabel="다시 시도"
        onAction={onRetry}
      />
    );
  }

  return (
    <>
      {isError ? (
        <FeedbackBanner
          title="새 기록을 확인하지 못했어요"
          description="아래에는 마지막으로 불러온 내용을 보여 드려요."
          actionLabel="새로고침"
          onAction={onRetry}
        />
      ) : null}
      <SurfaceCard variant="hero" tone="primary">
        <SectionHeader
          title="최근 30일 미리보기"
          description={`${formatDateKorean(preview.period.from)}부터 ${formatDateKorean(preview.period.to)}까지`}
        />
        <View style={styles.previewMetrics}>
          <StatCard
            variant="inline"
            label="소비 완료"
            value={preview.consumed}
            suffix="개"
          />
          <StatCard
            variant="inline"
            label="폐기"
            value={preview.discarded}
            suffix="개"
            tone="danger"
          />
        </View>
        <AppText variant="bodySmall" tone="subtext">
          {preview.ready
            ? "기록이 충분히 쌓였어요. 플러스에서 폐기율, 주간 추세와 실천 제안을 확인할 수 있어요."
            : `리포트 준비까지 ${Math.max(0, 5 - preview.resolved)}개의 소비·폐기 기록이 더 필요해요.`}
        </AppText>
        <Button
          fullWidth
          onPress={() => router.push("/settings/subscription")}
        >
          장고 플러스 살펴보기
        </Button>
      </SurfaceCard>
    </>
  );
}

function PlusReport({
  windowDays,
  onWindowChange,
  overview,
}: {
  windowDays: InsightWindowDays;
  onWindowChange: (days: InsightWindowDays) => void;
  overview: ReturnType<typeof useInsightsOverview>;
}) {
  return (
    <>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {([30, 90] as const).map((days) => (
          <Pressable
            key={days}
            accessibilityRole="radio"
            accessibilityLabel={`최근 ${days}일`}
            accessibilityState={{ selected: windowDays === days }}
            onPress={() => onWindowChange(days)}
            style={({ pressed }) => [
              styles.segmentButton,
              windowDays === days && styles.segmentButtonActive,
              pressed && styles.segmentButtonPressed,
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

      {overview.isLoading && !overview.data ? (
        <>
          <SkeletonBlock height={spacing.xxxl * 2} />
          <SkeletonBlock height={spacing.xxxl * 3} />
        </>
      ) : null}

      {overview.isError ? (
        <FeedbackBanner
          title={
            overview.data
              ? "새 기록을 확인하지 못했어요"
              : `${windowDays}일 리포트를 불러오지 못했어요`
          }
          description={
            overview.data
              ? "아래에는 마지막으로 불러온 내용을 보여 드려요."
              : "기록은 그대로 안전하게 보관되어 있어요. 잠시 후 다시 불러와 주세요."
          }
          actionLabel="다시 시도"
          onAction={() => {
            void overview.refetch();
          }}
          presentation={overview.data ? "inline" : "mascot"}
        />
      ) : null}

      {overview.data ? <ReportContent overview={overview.data} /> : null}
    </>
  );
}

function ReportContent({ overview }: { overview: PlusInsights }) {
  const weeklyMessage = weeklyTrendMessage(overview.weekly);
  const heroTone =
    overview.weekly.trend === "improved"
      ? "success"
      : overview.weekly.trend === "worse"
        ? "danger"
        : "primary";

  return (
    <>
      <SurfaceCard variant="hero" tone={heroTone} style={styles.summaryCard}>
        <AppText variant="bodySmallStrong" tone="subtext">
          최근 {overview.windowDays}일 폐기율
        </AppText>
        <AppText
          variant="display"
          tone={
            overview.weekly.trend === "improved"
              ? "success"
              : overview.weekly.trend === "worse"
                ? "danger"
                : "default"
          }
        >
          {overview.wasteRatePercent}%
        </AppText>
        <AppText variant="bodySmall">{weeklyMessage}</AppText>
        <AppText variant="caption" tone="subtext">
          {formatDateKorean(overview.period.from)}부터 {formatDateKorean(overview.period.to)}까지
        </AppText>
        <View style={styles.summaryMetrics}>
          <StatCard
            variant="inline"
            label="소비 완료"
            value={overview.consumed}
            suffix="개"
            tone="success"
          />
          <StatCard
            variant="inline"
            label="폐기"
            value={overview.discarded}
            suffix="개"
            tone="danger"
          />
          <StatCard
            variant="inline"
            label="7일 내 임박"
            value={overview.expiringSoon}
            suffix="개"
            tone="warning"
          />
        </View>
      </SurfaceCard>

      <TrendCard overview={overview} />

      <View style={styles.sectionStack}>
        <SectionHeader
          title="이번 주 장고 브리핑"
          description="지금 할 수 있는 행동부터 순서대로 보여 드려요."
          density="compact"
        />
        {overview.actions.length ? (
          <SurfaceCard variant="card" style={styles.listCard}>
            {overview.actions.map((action, index) => (
              <ActionRow
                key={action.kind}
                action={action}
                last={index === overview.actions.length - 1}
              />
            ))}
          </SurfaceCard>
        ) : (
          <SurfaceCard variant="card" tone="muted" style={styles.compactCard}>
            <AppText variant="bodySmall" tone="subtext">
              지금은 급한 행동이 없어요. 기록이 더 쌓이면 우선순위를 정해드릴게요.
            </AppText>
          </SurfaceCard>
        )}
      </View>

      {overview.topDiscardedCategories.length ? (
        <DiscardedCategories categories={overview.topDiscardedCategories} />
      ) : null}
    </>
  );
}

function TrendCard({ overview }: { overview: PlusInsights }) {
  const points = overview.trend ?? [];
  const hasResolvedEvents = points.some(
    (point) => point.consumed + point.discarded > 0,
  );

  return (
    <SurfaceCard variant="card" style={styles.compactCard}>
      <SectionHeader
        title="주별 폐기율 추세"
        description="막대가 낮을수록 소비로 마친 재료의 비중이 높아요."
        density="compact"
      />
      {points.length && hasResolvedEvents ? (
        <>
          <View
            style={styles.chart}
            accessible
            accessibilityRole="image"
            accessibilityLabel={points
              .map(
                (point) =>
                  `${formatDateKorean(point.from)}부터 ${formatDateKorean(point.to)}까지 폐기율 ${point.wasteRatePercent}%`,
              )
              .join(". ")}
          >
            {points.map((point) => (
              <View key={`${point.from}:${point.to}`} style={styles.chartColumn}>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.min(100, point.wasteRatePercent)}%`,
                        minHeight:
                          point.wasteRatePercent > 0
                            ? spacing.xxs
                            : spacing.none,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.chartAxis}>
            <AppText variant="caption" tone="muted">
              {formatTrendDate(points[0]!.from)}
            </AppText>
            <AppText variant="caption" tone="muted">
              {formatTrendDate(points[points.length - 1]!.to)}
            </AppText>
          </View>
        </>
      ) : (
        <AppText variant="bodySmall" tone="subtext">
          이 기간에는 비교할 소비·폐기 기록이 아직 없어요.
        </AppText>
      )}
    </SurfaceCard>
  );
}

function ActionRow({ action, last }: { action: InsightAction; last: boolean }) {
  const presentation = insightActionPresentation(action);
  const route = presentation.route;
  return (
    <ListRow
      title={presentation.title}
      description={presentation.description}
      icon={presentation.icon}
      density="compact"
      onPress={
        route
          ? () => router.push(route)
          : undefined
      }
      last={last}
    />
  );
}

function insightActionPresentation(action: InsightAction): {
  title: string;
  description: string;
  icon: typeof Sparkles;
  route: InsightActionRoute;
} {
  if (action.kind === "use_expiring") {
    return {
      title: `임박 재료 ${action.count}개로 추천받기`,
      description: action.itemNames.length
        ? action.itemNames.join(", ")
        : "먼저 쓸 재료로 오늘의 요리를 골라 보세요.",
      icon: Sparkles,
      route: "/(tabs)/recommendations",
    };
  }
  if (action.kind === "reduce_category_waste") {
    const category =
      productCategoryLabels[action.category as ProductCategory] ??
      action.category ??
      "재고";
    return {
      title: `${category} 재고 확인하기`,
      description: `최근 ${action.count}개를 버렸어요. 남은 양을 먼저 확인해 보세요.`,
      icon: Warehouse,
      route: "/(tabs)/inventory",
    };
  }
  if (action.kind === "review_waste_trend") {
    return {
      title: "다음 장보기 양을 조금 줄여 보세요",
      description: "이번 주 폐기율이 늘었어요. 자주 남는 재료부터 필요한 만큼만 골라 보세요.",
      icon: Lightbulb,
      route: null,
    };
  }
  return {
    title: "좋아진 소비 흐름을 이어가고 있어요",
    description: "이번 주처럼 임박한 재료를 먼저 확인하는 습관을 유지해 보세요.",
    icon: Lightbulb,
    route: null,
  };
}

function DiscardedCategories({
  categories,
}: {
  categories: PlusInsights["topDiscardedCategories"];
}) {
  const maxCount = Math.max(...categories.map((item) => item.count), 1);
  return (
    <SurfaceCard variant="card" style={styles.compactCard}>
      <SectionHeader
        title="자주 버린 분류"
        description="다음 장보기 전에 남은 양을 먼저 확인해 보세요."
        density="compact"
      />
      <View style={styles.categoryList}>
        {categories.map((item) => {
          const label =
            productCategoryLabels[item.category as ProductCategory] ??
            item.category;
          return (
            <View key={item.category} style={styles.categoryRow}>
              <View style={styles.categoryLabelRow}>
                <AppText variant="bodySmallStrong">{label}</AppText>
                <AppText variant="bodySmall" tone="subtext">
                  {item.count}개
                </AppText>
              </View>
              <View style={styles.categoryTrack}>
                <View
                  style={[
                    styles.categoryBar,
                    { width: `${(item.count / maxCount) * 100}%` },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </SurfaceCard>
  );
}

function weeklyTrendMessage(weekly: PlusInsights["weekly"]) {
  const change = weekly.wasteRateChangePercentagePoints;
  if (weekly.trend === "improved") {
    return `지난주보다 폐기율이 ${Math.abs(change ?? 0)}%p 줄었어요.`;
  }
  if (weekly.trend === "worse") {
    return `지난주보다 폐기율이 ${Math.abs(change ?? 0)}%p 늘었어요.`;
  }
  if (weekly.trend === "steady") {
    return "지난주와 비슷한 흐름이에요.";
  }
  return "2주간 기록이 쌓이면 변화를 비교해 드릴게요.";
}

function formatTrendDate(dateOnly: string) {
  const [, month, day] = dateOnly.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  intro: {
    gap: spacing.xxs,
  },
  sectionStack: {
    gap: spacing.xs,
  },
  segment: {
    minHeight: controlSize.minimum,
    flexDirection: "row",
    padding: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
  },
  segmentButton: {
    flex: 1,
    minHeight: controlSize.minimum,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
  },
  segmentButtonPressed: {
    opacity: 0.82,
  },
  previewMetrics: {
    flexDirection: "row",
    gap: spacing.md,
  },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryMetrics: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compactCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listCard: {
    padding: spacing.none,
    gap: spacing.none,
    overflow: "hidden",
  },
  chart: {
    height: spacing.xxxl,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xxs,
  },
  chartColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  chartTrack: {
    height: "100%",
    justifyContent: "flex-end",
    borderRadius: radius.md,
    backgroundColor: colors.mutedSurface,
    overflow: "hidden",
  },
  chartBar: {
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.dangerAccent,
  },
  chartAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryList: {
    gap: spacing.xs,
  },
  categoryRow: {
    gap: spacing.xxs,
  },
  categoryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  categoryTrack: {
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    overflow: "hidden",
  },
  categoryBar: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.dangerAccent,
  },
});
