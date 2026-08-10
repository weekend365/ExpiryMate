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
    ] = await Promise.all([
      this.prisma.subscriptionEntitlement.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        distinct: ["ownerKey"],
        select: { ownerKey: true },
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

    return {
      period: { days, from: from.toISOString(), to: to.toISOString() },
      totals: {
        activeSubscribers: activeSubscriberRows.length,
        activeUsers: activeUserRows.length,
        completedRecommendations: recommendationRows.length,
        estimatedAiCostUsd:
          Math.round(
            recommendationRows.reduce(
              (sum, row) => sum + Number(row.estimatedCostUsd),
              0,
            ) * 1_000_000,
          ) / 1_000_000,
        totalTokens: recommendationRows.reduce(
          (sum, row) => sum + row.totalTokens,
          0,
        ),
        paidCreditsSold: creditPurchaseAggregate._sum.creditsGranted ?? 0,
        paidCreditPurchases: creditPurchaseAggregate._count._all,
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
        paywallToPurchasePercent: percent(
          funnelTotal("purchase_verified"),
          funnelTotal("paywall_viewed"),
        ),
        rewardedAdVerificationPercent: percent(
          funnelTotal("rewarded_ad_verified"),
          funnelTotal("rewarded_ad_requested"),
        ),
        barcodeRewardGrantPercent: percent(
          funnelTotal("barcode_reward_granted"),
          funnelTotal("barcode_reward_granted") +
            funnelTotal("barcode_reward_denied"),
        ),
      },
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
