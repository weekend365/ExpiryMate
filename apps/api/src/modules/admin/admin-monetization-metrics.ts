import type { Prisma } from "@prisma/client";
import { toKstDateOnly } from "@expirymate/shared";
import type { getMonetizationEstimateConfig } from "../monetization/revenue-ledger";

export function roundKrw(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildAffiliatePlacementMetrics(
  rows: Array<{ eventName: string; properties: Prisma.JsonValue }>,
  shownEvent: string,
  tappedEvent: string,
) {
  const metrics = new Map<string, { impressions: number; taps: number }>();
  for (const row of rows) {
    if (row.eventName !== shownEvent && row.eventName !== tappedEvent) {
      continue;
    }
    const properties =
      row.properties &&
      typeof row.properties === "object" &&
      !Array.isArray(row.properties)
        ? row.properties
        : {};
    const placement =
      typeof properties.placement === "string" ? properties.placement : "unknown";
    const current = metrics.get(placement) ?? { impressions: 0, taps: 0 };
    if (row.eventName === shownEvent) current.impressions += 1;
    if (row.eventName === tappedEvent) current.taps += 1;
    metrics.set(placement, current);
  }
  return [...metrics.entries()]
    .map(([placement, counts]) => ({
      placement,
      ...counts,
      ctrPercent:
        counts.impressions > 0
          ? Math.round((counts.taps / counts.impressions) * 10_000) / 100
          : 0,
    }))
    .sort((left, right) => right.impressions - left.impressions);
}

export function groupRevenueBySource(
  rows: Array<{
    source: string;
    estimatedNetRevenueKrw: Prisma.Decimal;
    estimateConfigured: boolean;
  }>,
) {
  const grouped = new Map<
    string,
    { amount: number; events: number; configured: boolean }
  >(
    ["rewarded_ad", "paid_credit", "jango_plus", "jango_household"].map(
      (source) => [source, { amount: 0, events: 0, configured: true }],
    ),
  );
  for (const row of rows) {
    const current = grouped.get(row.source) ?? {
      amount: 0,
      events: 0,
      configured: true,
    };
    current.amount += Number(row.estimatedNetRevenueKrw);
    current.events += 1;
    current.configured = current.configured && row.estimateConfigured;
    grouped.set(row.source, current);
  }
  return grouped;
}

export function resolveConfiguredProductRevenue(
  config: ReturnType<typeof getMonetizationEstimateConfig>,
  row: {
    store: string;
    productId: string;
    billingPeriod: string | null;
    basePlanId: string | null;
  },
) {
  const keys = [
    [row.store, row.productId, row.basePlanId].filter(Boolean).join(":"),
    [row.store, row.productId, row.billingPeriod].filter(Boolean).join(":"),
    [row.store, row.productId].join(":"),
  ];
  return (
    keys
      .map((key) => config.productNetProceedsKrw[key])
      .find((value) => typeof value === "number") ?? null
  );
}

export function calculateRetention(
  users: Array<{ id: string; createdAt: Date }>,
  activity: Array<{ ownerKey: string; createdAt: Date }>,
  now: Date,
) {
  const activityByOwner = new Map<string, Date[]>();
  for (const event of activity) {
    const values = activityByOwner.get(event.ownerKey) ?? [];
    values.push(event.createdAt);
    activityByOwner.set(event.ownerKey, values);
  }
  const calculate = (
    candidateUsers: Array<{ id: string; createdAt: Date }>,
    day: number,
  ) => {
    const eligible = candidateUsers.filter(
      (user) => user.createdAt.getTime() <= now.getTime() - day * 86_400_000,
    );
    if (!eligible.length) return null;
    const retained = eligible.filter((user) => {
      const start = user.createdAt.getTime() + day * 86_400_000;
      const end = start + 86_400_000;
      return (activityByOwner.get(user.id) ?? []).some(
        (event) => event.getTime() >= start && event.getTime() < end,
      );
    }).length;
    return Math.round((retained / eligible.length) * 10_000) / 100;
  };
  const usersByCohort = new Map<string, Array<{ id: string; createdAt: Date }>>();
  for (const user of users) {
    const cohort = toKstDateOnly(user.createdAt);
    const cohortUsers = usersByCohort.get(cohort) ?? [];
    cohortUsers.push(user);
    usersByCohort.set(cohort, cohortUsers);
  }
  return {
    d7Percent: calculate(users, 7) ?? 0,
    d30Percent: calculate(users, 30) ?? 0,
    cohorts: [...usersByCohort.entries()]
      .map(([cohort, cohortUsers]) => ({
        cohort,
        users: cohortUsers.length,
        d7Percent: calculate(cohortUsers, 7),
        d30Percent: calculate(cohortUsers, 30),
      }))
      .sort((left, right) => left.cohort.localeCompare(right.cohort)),
  };
}

export function groupAiCostByRevenueSource(
  rows: Array<{
    estimatedCostUsd: Prisma.Decimal;
    usageEvent?: {
      source: string;
      subscriptionEntitlement: { planCode: string | null } | null;
    } | null;
  }>,
) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const usage = row.usageEvent;
    const source =
      usage?.source === "rewarded_ad"
        ? "rewarded_ad"
        : usage?.source === "paid_credit"
          ? "paid_credit"
          : usage?.source === "subscription"
            ? usage.subscriptionEntitlement?.planCode === "jango_household"
              ? "jango_household"
              : "jango_plus"
            : null;
    if (!source) continue;
    grouped.set(
      source,
      (grouped.get(source) ?? 0) + Number(row.estimatedCostUsd),
    );
  }
  return grouped;
}

export function buildCoreActivity({
  monetizationActivity,
  inventoryActivity,
  recommendationActivity,
}: {
  monetizationActivity: Array<{ ownerKey: string; createdAt: Date }>;
  inventoryActivity: Array<{
    ownerKey: string;
    createdByUserId: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  recommendationActivity: Array<{
    ownerKey: string;
    completedAt: Date | null;
  }>;
}) {
  const activity = [...monetizationActivity];
  for (const item of inventoryActivity) {
    activity.push({
      ownerKey: item.createdByUserId ?? item.ownerKey,
      createdAt: item.createdAt,
    });
    if (item.updatedAt.getTime() !== item.createdAt.getTime()) {
      activity.push({
        ownerKey: item.updatedByUserId ?? item.ownerKey,
        createdAt: item.updatedAt,
      });
    }
  }
  for (const recommendation of recommendationActivity) {
    if (recommendation.completedAt) {
      activity.push({
        ownerKey: recommendation.ownerKey,
        createdAt: recommendation.completedAt,
      });
    }
  }
  return activity;
}

export function configuredRevenue(
  row:
    | { amount: number; events: number; configured: boolean }
    | undefined,
) {
  return row?.configured ? roundKrw(row.amount) : null;
}

export function sourceAiCostKrw(
  costUsd: number | undefined,
  usdKrw: number | null,
) {
  return usdKrw === null ? null : roundKrw((costUsd ?? 0) * usdKrw);
}

export function buildUnitEconomicsGuardrail({
  revenue,
  revenueUnits,
  aiCostKrw,
  recommendationUnits,
  targetCoverageMultiple,
}: {
  revenue: number | null;
  revenueUnits: number;
  aiCostKrw: number | null;
  recommendationUnits: number;
  targetCoverageMultiple: number;
}) {
  if (revenue === null || aiCostKrw === null) {
    return {
      estimatedRevenuePerUnitKrw: null,
      estimatedAiCostPerRecommendationKrw: null,
      costCoverageMultiple: null,
      targetCoverageMultiple,
      status: "unconfigured" as const,
    };
  }
  if (revenueUnits <= 0 || recommendationUnits <= 0 || aiCostKrw <= 0) {
    return {
      estimatedRevenuePerUnitKrw:
        revenueUnits > 0 ? roundKrw(revenue / revenueUnits) : null,
      estimatedAiCostPerRecommendationKrw:
        recommendationUnits > 0
          ? roundKrw(aiCostKrw / recommendationUnits)
          : null,
      costCoverageMultiple: null,
      targetCoverageMultiple,
      status: "insufficient_data" as const,
    };
  }
  const estimatedRevenuePerUnitKrw = roundKrw(revenue / revenueUnits);
  const estimatedAiCostPerRecommendationKrw = roundKrw(
    aiCostKrw / recommendationUnits,
  );
  const costCoverageMultiple =
    estimatedAiCostPerRecommendationKrw > 0
      ? Math.round(
          (estimatedRevenuePerUnitKrw /
            estimatedAiCostPerRecommendationKrw) *
            100,
        ) / 100
      : null;
  return {
    estimatedRevenuePerUnitKrw,
    estimatedAiCostPerRecommendationKrw,
    costCoverageMultiple,
    targetCoverageMultiple,
    status:
      costCoverageMultiple !== null &&
      costCoverageMultiple >= targetCoverageMultiple
        ? ("healthy" as const)
        : ("review" as const),
  };
}

export function percentile(values: number[], percentileValue: number) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index] ?? null;
}
