import { Injectable } from "@nestjs/common";
import { ItemStatus, Prisma } from "@prisma/client";
import {
  dateOnlyToUtcDate,
  getKstDayWindow,
  sortInventoryByNearestExpiry,
  StorageLocation,
  toKstDateOnly,
  type DashboardSummary,
  type InventoryItem,
} from "@expirymate/shared";
import { serializeAdminInventoryItem } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import {
  getMonetizationEstimateConfig,
  validateMonetizationEstimates,
} from "../monetization/revenue-ledger";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface AdminInventoryListParams {
  page?: number;
  limit?: number;
  q?: string;
}

export interface AdminInventoryListResponse {
  items: InventoryItem[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
}

export interface AdminMonetizationOverview {
  period: { days: number; from: string; to: string };
  totals: {
    activeSubscribers: number;
    activeUsers: number;
    completedRecommendations: number;
    estimatedAiCostUsd: number;
    totalTokens: number;
    paidCreditsSold: number;
    paidCreditPurchases: number;
    estimatedNetRevenueKrw: number | null;
    estimatedAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    arppuKrw: number | null;
    estimatedMrrKrw: number | null;
    renewalRatePercent: number;
    churnRefundRatePercent: number;
  };
  usageBySource: Array<{ source: string; count: number }>;
  funnel: Array<{
    event: string;
    control: number;
    valueFirst: number;
    other: number;
    total: number;
  }>;
  conversion: {
    paywallToPurchasePercent: number;
    rewardedAdVerificationPercent: number;
    barcodeRewardGrantPercent: number;
  };
  economicsConfigured: boolean;
  economicsBySource: Array<{
    source: string;
    estimatedNetRevenueKrw: number | null;
    estimatedAiCostKrw: number | null;
    estimatedContributionKrw: number | null;
    estimatedContributionMarginPercent: number | null;
    events: number;
  }>;
  retention: {
    d7Percent: number;
    d30Percent: number;
    cohorts: Array<{
      cohort: string;
      users: number;
      d7Percent: number | null;
      d30Percent: number | null;
    }>;
  };
  daily: Array<{
    day: string;
    recommendations: number;
    aiCostUsd: number;
  }>;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listInventory(
    params: AdminInventoryListParams = {},
  ): Promise<AdminInventoryListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE),
    );
    const q = params.q?.trim();
    const where: Prisma.InventoryItemWhereInput = q
      ? {
          OR: [
            {
              displayName: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              brand: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {};

    const [totalCount, items] = await this.prisma.$transaction([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items.map(serializeAdminInventoryItem),
      page,
      limit,
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  async getDashboardSummary(now = new Date()): Promise<DashboardSummary> {
    const today = dateOnlyToUtcDate(toKstDateOnly(now));
    const in3Days = addUtcDays(today, 3);
    const in7Days = addUtcDays(today, 7);
    const trackedWhere: Prisma.InventoryItemWhereInput = {
      status: {
        in: [ItemStatus.active, ItemStatus.expired],
      },
    };

    const [
      totalActiveCount,
      expiredCount,
      todayExpiryCount,
      within3DaysCount,
      within7DaysCount,
      safeCount,
      locationGroups,
      recentRows,
      expiringRows,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: trackedWhere }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: { lt: today },
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: today,
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: {
            gte: today,
            lte: in3Days,
          },
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: {
            gte: today,
            lte: in7Days,
          },
        },
      }),
      this.prisma.inventoryItem.count({
        where: {
          ...trackedWhere,
          expiryDate: { gt: in7Days },
        },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ["storageLocation"],
        where: trackedWhere,
        _count: { _all: true },
      }),
      this.prisma.inventoryItem.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.inventoryItem.findMany({
        where: trackedWhere,
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        take: 40,
      }),
    ]);

    const recentItems = recentRows.map(serializeAdminInventoryItem);
    const expiringItems = sortInventoryByNearestExpiry(
      expiringRows.map(serializeAdminInventoryItem),
      now,
    ).slice(0, 5);

    const locationCounts = Object.values(StorageLocation).reduce<
      Record<string, number>
    >((result, location) => {
      result[location] = 0;
      return result;
    }, {});

    for (const group of locationGroups) {
      locationCounts[group.storageLocation] = group._count._all;
    }

    return {
      todayExpiryCount,
      within3DaysCount,
      within7DaysCount,
      expiredCount,
      safeCount,
      totalActiveCount,
      recentItems,
      expiringItems,
      locationCounts,
      latestRecommendationPreview: null,
    };
  }

  async getMonetizationOverview(
    requestedDays = 30,
    now = new Date(),
  ): Promise<AdminMonetizationOverview> {
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const today = getKstDayWindow(now).start;
    const from = addUtcDays(today, -(days - 1));
    const to = new Date(now);
    const activeUsageStatuses = ["reserved", "completed"] as const;

    const [
      activeSubscriberRows,
      activeUserRows,
      usageGroups,
      recommendationRows,
      funnelGroups,
      creditPurchaseAggregate,
      revenueRows,
      uniqueFunnelRows,
      cohortUsers,
      cohortActivity,
    ] = await Promise.all([
      this.prisma.subscriptionEntitlement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          ownerKey: true,
          store: true,
          productId: true,
          billingPeriod: true,
          basePlanId: true,
        },
      }),
      this.prisma.recommendationUsageEvent.findMany({
        where: {
          usageDay: { gte: from, lte: to },
          status: { in: [...activeUsageStatuses] },
        },
        distinct: ["ownerKey"],
        select: { ownerKey: true },
      }),
      this.prisma.recommendationUsageEvent.groupBy({
        by: ["source", "status"],
        where: {
          usageDay: { gte: from, lte: to },
          status: { in: [...activeUsageStatuses] },
        },
        _count: { _all: true },
      }),
      this.prisma.recipeRecommendation.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          createdAt: true,
          estimatedCostUsd: true,
          totalTokens: true,
          usageEvent: {
            select: {
              source: true,
              subscriptionEntitlement: { select: { planCode: true } },
            },
          },
        },
      }),
      this.prisma.monetizationFunnelEvent.groupBy({
        by: ["eventName", "experimentVariant"],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.recommendationCreditPurchase.aggregate({
        where: {
          status: "active",
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
        _sum: { creditsGranted: true },
      }),
      hasDelegate(this.prisma, "monetizationRevenueEvent")
        ? this.prisma.monetizationRevenueEvent.findMany({
            where: { occurredAt: { gte: from, lte: to } },
            select: {
              ownerKey: true,
              source: true,
              kind: true,
              billingPeriod: true,
              estimatedNetRevenueKrw: true,
              estimateConfigured: true,
            },
          })
        : Promise.resolve([]),
      hasMethod(this.prisma.monetizationFunnelEvent, "findMany")
        ? this.prisma.monetizationFunnelEvent.findMany({
            where: {
              createdAt: { gte: from, lte: to },
              eventName: {
                in: [
                  "paywall_viewed",
                  "purchase_verified",
                  "rewarded_ad_requested",
                  "rewarded_ad_verified",
                  "barcode_reward_granted",
                  "barcode_reward_denied",
                ],
              },
            },
            distinct: ["ownerKey", "eventName"],
            select: { ownerKey: true, eventName: true },
          })
        : Promise.resolve([]),
      hasDelegate(this.prisma, "user")
        ? this.prisma.user.findMany({
            where: {
              accountType: "registered",
              createdAt: { gte: addUtcDays(today, -90), lte: to },
            },
            select: { id: true, createdAt: true },
          })
        : Promise.resolve([]),
      hasMethod(this.prisma.monetizationFunnelEvent, "findMany")
        ? this.prisma.monetizationFunnelEvent.findMany({
            where: { createdAt: { gte: addUtcDays(today, -90), lte: to } },
            select: { ownerKey: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const usageBySource = new Map<string, number>();
    for (const group of usageGroups) {
      usageBySource.set(
        group.source,
        (usageBySource.get(group.source) ?? 0) + group._count._all,
      );
    }

    const funnel = new Map<
      string,
      { control: number; valueFirst: number; other: number }
    >();
    for (const group of funnelGroups) {
      const row = funnel.get(group.eventName) ?? {
        control: 0,
        valueFirst: 0,
        other: 0,
      };
      if (group.experimentVariant === "control") {
        row.control += group._count._all;
      } else if (group.experimentVariant === "value_first") {
        row.valueFirst += group._count._all;
      } else {
        row.other += group._count._all;
      }
      funnel.set(group.eventName, row);
    }

    const dailyMap = new Map<
      string,
      { recommendations: number; aiCostUsd: number }
    >();
    for (let index = 0; index < days; index += 1) {
      const day = addUtcDays(from, index).toISOString().slice(0, 10);
      dailyMap.set(day, { recommendations: 0, aiCostUsd: 0 });
    }
    for (const recommendation of recommendationRows) {
      const day = getKstDayWindow(recommendation.createdAt).start
        .toISOString()
        .slice(0, 10);
      const row = dailyMap.get(day);
      if (!row) continue;
      row.recommendations += 1;
      row.aiCostUsd += Number(recommendation.estimatedCostUsd);
    }

    const funnelTotal = (event: string) => {
      const row = funnel.get(event);
      return row ? row.control + row.valueFirst + row.other : 0;
    };
    const percent = (numerator: number, denominator: number) =>
      denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
    const totalAiCostUsd = recommendationRows.reduce(
      (sum, row) => sum + Number(row.estimatedCostUsd),
      0,
    );
    const estimates = getMonetizationEstimateConfig();
    const economicsConfigured =
      validateMonetizationEstimates() &&
      revenueRows.every((row) => row.estimateConfigured);
    const estimatedNetRevenueKrw = economicsConfigured
      ? roundKrw(
          revenueRows.reduce(
            (sum, row) => sum + Number(row.estimatedNetRevenueKrw),
            0,
          ),
        )
      : null;
    const estimatedAiCostKrw = estimates.usdKrw
      ? roundKrw(totalAiCostUsd * estimates.usdKrw)
      : null;
    const estimatedContributionKrw =
      estimatedNetRevenueKrw !== null && estimatedAiCostKrw !== null
        ? roundKrw(estimatedNetRevenueKrw - estimatedAiCostKrw)
        : null;
    const payingUsers = new Set(
      revenueRows
        .filter((row) => Number(row.estimatedNetRevenueKrw) > 0)
        .map((row) => row.ownerKey)
        .filter(Boolean),
    ).size;
    const subscriptionRevenueEvents = revenueRows.filter((row) =>
      ["subscription_purchase", "subscription_renewal"].includes(row.kind),
    );
    const renewalEvents = revenueRows.filter(
      (row) => row.kind === "subscription_renewal",
    ).length;
    const churnEvents = revenueRows.filter((row) =>
      ["subscription_cancelled", "subscription_refund"].includes(row.kind),
    ).length;
    const uniqueFunnelCount = (eventName: string) =>
      new Set(
        uniqueFunnelRows
          .filter((row) => row.eventName === eventName)
          .map((row) => row.ownerKey),
      ).size;
    const uniqueFunnelOwners = (eventName: string) =>
      new Set(
        uniqueFunnelRows
          .filter((row) => row.eventName === eventName)
          .map((row) => row.ownerKey),
      );
    const paywallOwners = uniqueFunnelOwners("paywall_viewed");
    const purchasingPaywallOwners = [...uniqueFunnelOwners(
      "purchase_verified",
    )].filter((ownerKey) => paywallOwners.has(ownerKey)).length;
    const aiCostBySourceUsd = groupAiCostByRevenueSource(recommendationRows);
    const economicsBySource = [...groupRevenueBySource(revenueRows).entries()]
      .map(([source, row]) => {
        const sourceRevenue =
          row.events === 0
            ? economicsConfigured
              ? 0
              : null
            : row.configured
              ? roundKrw(row.amount)
              : null;
        const sourceAiCost = estimates.usdKrw
          ? roundKrw((aiCostBySourceUsd.get(source) ?? 0) * estimates.usdKrw)
          : null;
        const sourceContribution =
          sourceRevenue !== null && sourceAiCost !== null
            ? roundKrw(sourceRevenue - sourceAiCost)
            : null;
        return {
          source,
          events: row.events,
          estimatedNetRevenueKrw: sourceRevenue,
          estimatedAiCostKrw: sourceAiCost,
          estimatedContributionKrw: sourceContribution,
          estimatedContributionMarginPercent:
            sourceRevenue && sourceContribution !== null
              ? percent(sourceContribution, sourceRevenue)
              : null,
        };
      })
      .sort((left, right) => right.events - left.events);
    const activeMonthlyRevenue = activeSubscriberRows.map((row) => {
      const amount = resolveConfiguredProductRevenue(estimates, row);
      if (amount === null) return null;
      return row.billingPeriod === "yearly" ? amount / 12 : amount;
    });
    const estimatedMrrKrw =
      validateMonetizationEstimates() &&
      activeMonthlyRevenue.every((amount) => amount !== null)
        ? roundKrw(
            activeMonthlyRevenue.reduce<number>(
              (sum, amount) => sum + (amount ?? 0),
              0,
            ),
          )
        : null;
    const retention = calculateRetention(cohortUsers, cohortActivity, now);

    return {
      period: { days, from: from.toISOString(), to: to.toISOString() },
      totals: {
        activeSubscribers: new Set(
          activeSubscriberRows.map((row) => row.ownerKey),
        ).size,
        activeUsers: activeUserRows.length,
        completedRecommendations: recommendationRows.length,
        estimatedAiCostUsd:
          Math.round(totalAiCostUsd * 1_000_000) / 1_000_000,
        totalTokens: recommendationRows.reduce(
          (sum, row) => sum + row.totalTokens,
          0,
        ),
        paidCreditsSold: creditPurchaseAggregate._sum.creditsGranted ?? 0,
        paidCreditPurchases: creditPurchaseAggregate._count._all,
        estimatedNetRevenueKrw,
        estimatedAiCostKrw,
        estimatedContributionKrw,
        estimatedContributionMarginPercent:
          estimatedNetRevenueKrw && estimatedContributionKrw !== null
            ? percent(estimatedContributionKrw, estimatedNetRevenueKrw)
            : null,
        arppuKrw:
          estimatedNetRevenueKrw !== null && payingUsers > 0
            ? roundKrw(estimatedNetRevenueKrw / payingUsers)
            : null,
        estimatedMrrKrw,
        renewalRatePercent: percent(
          renewalEvents,
          subscriptionRevenueEvents.length,
        ),
        churnRefundRatePercent: percent(
          churnEvents,
          subscriptionRevenueEvents.length,
        ),
      },
      usageBySource: [...usageBySource.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((left, right) => right.count - left.count),
      funnel: [...funnel.entries()]
        .map(([event, row]) => ({
          event,
          ...row,
          total: row.control + row.valueFirst + row.other,
        }))
        .sort((left, right) => right.total - left.total),
      conversion: {
        paywallToPurchasePercent: uniqueFunnelRows.length
          ? percent(
              purchasingPaywallOwners,
              paywallOwners.size,
            )
          : percent(
              funnelTotal("purchase_verified"),
              funnelTotal("paywall_viewed"),
            ),
        rewardedAdVerificationPercent: uniqueFunnelRows.length
          ? percent(
              uniqueFunnelCount("rewarded_ad_verified"),
              uniqueFunnelCount("rewarded_ad_requested"),
            )
          : percent(
              funnelTotal("rewarded_ad_verified"),
              funnelTotal("rewarded_ad_requested"),
            ),
        barcodeRewardGrantPercent: uniqueFunnelRows.length
          ? percent(
              uniqueFunnelCount("barcode_reward_granted"),
              uniqueFunnelCount("barcode_reward_granted") +
                uniqueFunnelCount("barcode_reward_denied"),
            )
          : percent(
              funnelTotal("barcode_reward_granted"),
              funnelTotal("barcode_reward_granted") +
                funnelTotal("barcode_reward_denied"),
            ),
      },
      economicsConfigured,
      economicsBySource,
      retention,
      daily: [...dailyMap.entries()].map(([day, row]) => ({
        day,
        recommendations: row.recommendations,
        aiCostUsd: Math.round(row.aiCostUsd * 1_000_000) / 1_000_000,
      })),
    };
  }
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function roundKrw(value: number) {
  return Math.round(value * 100) / 100;
}

function hasDelegate(value: unknown, key: string) {
  return Boolean(
    value &&
      typeof value === "object" &&
      key in value &&
      (value as Record<string, unknown>)[key],
  );
}

function hasMethod(value: unknown, key: string) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>)[key] === "function",
  );
}

function groupRevenueBySource(
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

function resolveConfiguredProductRevenue(
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

function calculateRetention(
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

function groupAiCostByRevenueSource(
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
