import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  InventoryDispositionOutcome,
  ItemStatus,
  type ProductCategory,
} from "@prisma/client";
import {
  addDaysToDateOnly,
  dateOnlyToUtcDate,
  getKstDayWindow,
  type InsightPreview,
  type InsightWindowDays,
  type PlusInsights,
  toKstDateOnly,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreview(
    ownerKey: string,
    spaceId: string,
    now = new Date(),
  ): Promise<InsightPreview> {
    await this.requireMembership(ownerKey, spaceId);
    const { from, endExclusive, toDateOnly } = resolveWindow(30, now);
    const [groups, accumulatedEvents] = await Promise.all([
      this.prisma.inventoryDispositionEvent.groupBy({
        by: ["outcome"],
        where: { spaceId, occurredAt: { gte: from, lt: endExclusive } },
        _count: { _all: true },
      }),
      this.prisma.inventoryDispositionEvent.count({ where: { spaceId } }),
    ]);
    const totals = resolveInsightTotals(groups);

    return {
      period: {
        from: toKstDateOnly(from),
        to: toDateOnly,
      },
      consumed: totals.consumed,
      discarded: totals.discarded,
      resolved: totals.resolved,
      ready: accumulatedEvents >= 5,
    };
  }

  async getOverview(
    ownerKey: string,
    spaceId: string,
    windowDays: InsightWindowDays,
    now = new Date(),
  ): Promise<PlusInsights> {
    await Promise.all([
      this.requireMembership(ownerKey, spaceId),
      this.requirePersonalPlus(ownerKey, now),
    ]);

    const { from, endExclusive, toDateOnly } = resolveWindow(windowDays, now);
    const currentWeekFrom = new Date(endExclusive.getTime() - 7 * DAY_MS);
    const previousWeekFrom = new Date(currentWeekFrom.getTime() - 7 * DAY_MS);
    const today = dateOnlyToUtcDate(toDateOnly);
    const nextWeek = dateOnlyToUtcDate(addDaysToDateOnly(toDateOnly, 7));

    const [
      periodGroups,
      currentWeekGroups,
      previousWeekGroups,
      trendEvents,
      expiringSoon,
      expiringItems,
      discardedCategories,
    ] = await Promise.all([
      this.countOutcomes(spaceId, from, endExclusive),
      this.countOutcomes(spaceId, currentWeekFrom, endExclusive),
      this.countOutcomes(spaceId, previousWeekFrom, currentWeekFrom),
      this.prisma.inventoryDispositionEvent.findMany({
        where: { spaceId, occurredAt: { gte: from, lt: endExclusive } },
        select: { outcome: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
      }),
      this.prisma.inventoryItem.count({
        where: {
          spaceId,
          status: ItemStatus.active,
          expiryDate: { gte: today, lte: nextWeek },
        },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          spaceId,
          status: ItemStatus.active,
          expiryDate: { gte: today, lte: nextWeek },
        },
        select: { displayName: true, expiryDate: true },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
        take: 3,
      }),
      this.prisma.inventoryDispositionEvent.groupBy({
        by: ["category"],
        where: {
          spaceId,
          outcome: InventoryDispositionOutcome.discarded,
          occurredAt: { gte: from, lt: endExclusive },
          category: { not: null },
        },
        _count: { _all: true },
        orderBy: { _count: { category: "desc" } },
        take: 3,
      }),
    ]);

    const totals = resolveInsightTotals(periodGroups);
    const currentWeek = resolveInsightTotals(currentWeekGroups);
    const previousWeek = resolveInsightTotals(previousWeekGroups);
    const wasteRateChangePercentagePoints =
      currentWeek.resolved > 0 && previousWeek.resolved > 0
        ? Math.round(
            (currentWeek.wasteRatePercent - previousWeek.wasteRatePercent) * 10,
          ) / 10
        : null;
    const weeklyTrend = resolveWasteTrend(wasteRateChangePercentagePoints);

    return {
      windowDays,
      period: { from: toKstDateOnly(from), to: toDateOnly },
      consumed: totals.consumed,
      discarded: totals.discarded,
      wasteRatePercent: totals.wasteRatePercent,
      expiringSoon,
      topDiscardedCategories: discardedCategories
        .filter((group): group is typeof group & { category: ProductCategory } =>
          group.category !== null,
        )
        .map((group) => ({
          category: group.category,
          count: group._count._all,
        })),
      trend: buildWeeklyTrend(from, endExclusive, trendEvents),
      actions: buildInsightActions({
        expiringSoon,
        expiringItems,
        topDiscardedCategory: discardedCategories[0] ?? null,
        weeklyTrend,
      }),
      weekly: {
        current: periodSummary(currentWeekFrom, endExclusive, currentWeek),
        previous: periodSummary(previousWeekFrom, currentWeekFrom, previousWeek),
        wasteRateChangePercentagePoints,
        trend: weeklyTrend,
      },
    };
  }

  private countOutcomes(spaceId: string, from: Date, to: Date) {
    return this.prisma.inventoryDispositionEvent.groupBy({
      by: ["outcome"],
      where: { spaceId, occurredAt: { gte: from, lt: to } },
      _count: { _all: true },
    });
  }

  private async requireMembership(ownerKey: string, spaceId: string) {
    const membership = await this.prisma.inventorySpaceMembership.findUnique({
      where: { spaceId_userId: { spaceId, userId: ownerKey } },
      select: { spaceId: true },
    });
    if (!membership) {
      throw new ForbiddenException("이 공간의 리포트를 볼 수 없습니다.");
    }
  }

  private async requirePersonalPlus(ownerKey: string, now: Date) {
    const entitlement = await this.prisma.subscriptionEntitlement.findFirst({
      where: {
        ownerKey,
        spaceId: null,
        planCode: "jango_plus",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (!entitlement) {
      throw new ForbiddenException("장고 플러스 구독자만 전체 리포트를 볼 수 있습니다.");
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function resolveWindow(windowDays: InsightWindowDays, now: Date) {
  const { endExclusive } = getKstDayWindow(now);
  const from = new Date(endExclusive.getTime() - windowDays * DAY_MS);
  return { from, endExclusive, toDateOnly: toKstDateOnly(now) };
}

function resolveInsightTotals(
  groups: Array<{
    outcome: InventoryDispositionOutcome;
    _count: { _all: number };
  }>,
) {
  const count = (outcome: InventoryDispositionOutcome) =>
    groups.find((group) => group.outcome === outcome)?._count._all ?? 0;
  const consumed = count(InventoryDispositionOutcome.consumed);
  const discarded = count(InventoryDispositionOutcome.discarded);
  const resolved = consumed + discarded;
  return {
    consumed,
    discarded,
    resolved,
    wasteRatePercent:
      resolved > 0 ? Math.round((discarded / resolved) * 1000) / 10 : 0,
  };
}

function periodSummary(
  from: Date,
  toExclusive: Date,
  totals: ReturnType<typeof resolveInsightTotals>,
) {
  return {
    from: toKstDateOnly(from),
    to: toKstDateOnly(new Date(toExclusive.getTime() - 1)),
    consumed: totals.consumed,
    discarded: totals.discarded,
    wasteRatePercent: totals.wasteRatePercent,
  };
}

function buildWeeklyTrend(
  from: Date,
  endExclusive: Date,
  events: Array<{
    outcome: InventoryDispositionOutcome;
    occurredAt: Date;
  }>,
): NonNullable<PlusInsights["trend"]> {
  const ranges: Array<{ from: Date; endExclusive: Date }> = [];
  let bucketEndExclusive = new Date(endExclusive);

  while (bucketEndExclusive > from) {
    const bucketFrom = new Date(
      Math.max(from.getTime(), bucketEndExclusive.getTime() - 7 * DAY_MS),
    );
    ranges.unshift({ from: bucketFrom, endExclusive: bucketEndExclusive });
    bucketEndExclusive = bucketFrom;
  }

  return ranges.map(({ from: bucketFrom, endExclusive: bucketEnd }) => {
    const bucketEvents = events.filter(
      (event) =>
        event.occurredAt >= bucketFrom && event.occurredAt < bucketEnd,
    );
    const consumed = bucketEvents.filter(
      (event) => event.outcome === InventoryDispositionOutcome.consumed,
    ).length;
    const discarded = bucketEvents.filter(
      (event) => event.outcome === InventoryDispositionOutcome.discarded,
    ).length;
    const resolved = consumed + discarded;

    return {
      from: toKstDateOnly(bucketFrom),
      to: toKstDateOnly(new Date(bucketEnd.getTime() - 1)),
      consumed,
      discarded,
      wasteRatePercent:
        resolved > 0 ? Math.round((discarded / resolved) * 1000) / 10 : 0,
    };
  });
}

function resolveWasteTrend(change: number | null) {
  if (change === null) return "insufficient_data" as const;
  if (change <= -1) return "improved" as const;
  if (change >= 1) return "worse" as const;
  return "steady" as const;
}

function buildInsightActions(input: {
  expiringSoon: number;
  expiringItems: Array<{ displayName: string; expiryDate: Date | null }>;
  topDiscardedCategory: {
    category: ProductCategory | null;
    _count: { _all: number };
  } | null;
  weeklyTrend: ReturnType<typeof resolveWasteTrend>;
}): PlusInsights["actions"] {
  const actions: PlusInsights["actions"] = [];
  if (input.expiringSoon > 0) {
    actions.push({
      kind: "use_expiring",
      priority: "high",
      count: input.expiringSoon,
      itemNames: input.expiringItems.map((item) => item.displayName),
      category: null,
      nearestExpiryDate:
        input.expiringItems[0]?.expiryDate?.toISOString().slice(0, 10) ?? null,
    });
  }
  if (input.topDiscardedCategory?.category) {
    actions.push({
      kind: "reduce_category_waste",
      priority: input.weeklyTrend === "worse" ? "high" : "medium",
      count: input.topDiscardedCategory._count._all,
      itemNames: [],
      category: input.topDiscardedCategory.category,
      nearestExpiryDate: null,
    });
  }
  if (input.weeklyTrend === "worse") {
    actions.push({
      kind: "review_waste_trend",
      priority: "medium",
      count: 0,
      itemNames: [],
      category: null,
      nearestExpiryDate: null,
    });
  } else if (input.weeklyTrend === "improved") {
    actions.push({
      kind: "keep_momentum",
      priority: "low",
      count: 0,
      itemNames: [],
      category: null,
      nearestExpiryDate: null,
    });
  }
  return actions.slice(0, 3);
}
