import { ItemStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { maskOwnerKey } from "../../common/serializers";
import {
  AdminService,
  buildAffiliatePlacementMetrics,
} from "./admin.service";

describe("AdminService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps affiliate product and entry placement funnels separate", () => {
    const rows = [
      {
        eventName: "affiliate_product_shown",
        properties: { placement: "shopping_search" },
      },
      {
        eventName: "affiliate_product_tapped",
        properties: { placement: "shopping_search" },
      },
      {
        eventName: "affiliate_entry_shown",
        properties: { placement: "shopping_tab" },
      },
    ];

    expect(
      buildAffiliatePlacementMetrics(
        rows,
        "affiliate_product_shown",
        "affiliate_product_tapped",
      ),
    ).toEqual([
      {
        placement: "shopping_search",
        impressions: 1,
        taps: 1,
        ctrPercent: 100,
      },
    ]);
    expect(
      buildAffiliatePlacementMetrics(
        rows,
        "affiliate_entry_shown",
        "affiliate_entry_tapped",
      ),
    ).toEqual([
      {
        placement: "shopping_tab",
        impressions: 1,
        taps: 0,
        ctrPercent: 0,
      },
    ]);
  });
  it("paginates inventory and masks owner/notes fields", async () => {
    const row = {
      id: "item-1",
      productId: null,
      ownerKey: "user_secret_owner",
      displayName: "우유",
      brand: "서울",
      category: null,
      quantity: 1,
      unit: "개",
      storageLocation: "fridge",
      expiryDate: new Date("2026-07-23T00:00:00.000Z"),
      expirySource: "manual",
      status: ItemStatus.active,
      notes: "비밀 메모",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };

    const prisma = {
      $transaction: vi.fn(async (ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
      inventoryItem: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([row]),
      },
    };

    const service = new AdminService(prisma as never);
    const result = await service.listInventory({ page: 1, limit: 50, q: "우유" });

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      }),
    );
    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.notes).toBeNull();
    expect(result.items[0]?.ownerKey).toBe(maskOwnerKey("user_secret_owner"));
    expect(result.items[0]?.ownerKey).not.toBe("user_secret_owner");
  });

  it("builds dashboard summary from aggregates instead of a full table scan", async () => {
    const prisma = {
      inventoryItem: {
        count: vi
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(0),
        groupBy: vi.fn().mockResolvedValue([
          { storageLocation: "fridge", _count: { _all: 7 } },
        ]),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new AdminService(prisma as never);
    const summary = await service.getDashboardSummary(
      new Date("2026-07-22T01:00:00.000Z"),
    );

    expect(summary.totalActiveCount).toBe(10);
    expect(summary.expiredCount).toBe(2);
    expect(summary.todayExpiryCount).toBe(1);
    expect(summary.within7DaysCount).toBe(4);
    expect(summary.safeCount).toBe(4);
    expect(summary.unknownExpiryCount).toBe(0);
    expect(
      summary.expiredCount +
        summary.within7DaysCount +
        summary.unknownExpiryCount +
        summary.safeCount,
    ).toBe(summary.totalActiveCount);
    expect(prisma.inventoryItem.count).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        where: expect.objectContaining({
          expiryDate: {
            gte: new Date("2026-07-22T00:00:00.000Z"),
            lte: new Date("2026-07-29T00:00:00.000Z"),
          },
        }),
      }),
    );
    expect(prisma.inventoryItem.count).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        where: expect.objectContaining({
          expiryDate: { gt: new Date("2026-07-29T00:00:00.000Z") },
        }),
      }),
    );
    expect(summary.locationCounts.fridge).toBe(7);
    expect(summary.latestRecommendationPreview).toBeNull();
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledTimes(2);
  });

  it("aggregates monetization usage, cost, and conversion rates", async () => {
    const prisma = {
      subscriptionEntitlement: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { ownerKey: "subscriber-1" },
            { ownerKey: "subscriber-2" },
            { ownerKey: "subscriber-3" },
            { ownerKey: "subscriber-4" },
          ])
          .mockResolvedValueOnce([
            { ownerKey: "subscriber-1" },
            { ownerKey: "subscriber-2" },
            { ownerKey: "subscriber-3" },
            { ownerKey: "subscriber-4" },
            { ownerKey: "subscriber-5" },
          ]),
      },
      recommendationUsageEvent: {
        findMany: vi.fn().mockResolvedValue([
          { ownerKey: "user-1" },
          { ownerKey: "user-2" },
        ]),
        groupBy: vi.fn().mockResolvedValue([
          { source: "free", status: "completed", _count: { _all: 5 } },
          { source: "subscription", status: "completed", _count: { _all: 3 } },
        ]),
      },
      recipeRecommendation: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-08-10T01:00:00.000Z"),
            estimatedCostUsd: 0.012,
            totalTokens: 1000,
          },
          {
            createdAt: new Date("2026-08-10T02:00:00.000Z"),
            estimatedCostUsd: 0.008,
            totalTokens: 800,
          },
        ]),
      },
      monetizationFunnelEvent: {
        groupBy: vi.fn().mockResolvedValue([
          { eventName: "paywall_viewed", experimentVariant: "control", _count: { _all: 10 } },
          { eventName: "purchase_verified", experimentVariant: "control", _count: { _all: 2 } },
          { eventName: "rewarded_ad_requested", experimentVariant: "control", _count: { _all: 8 } },
          { eventName: "rewarded_ad_verified", experimentVariant: "control", _count: { _all: 6 } },
        ]),
      },
      recommendationCreditPurchase: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: { creditsGranted: 20 },
        }),
      },
      monetizationRevenueEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            ownerKey: "new-subscriber",
            source: "jango_plus",
            kind: "subscription_purchase",
            billingPeriod: "monthly",
            estimatedNetRevenueKrw: 0,
            estimateConfigured: false,
          },
          {
            ownerKey: "subscriber-1",
            source: "jango_plus",
            kind: "subscription_renewal",
            billingPeriod: "monthly",
            estimatedNetRevenueKrw: 0,
            estimateConfigured: false,
          },
          {
            ownerKey: "subscriber-2",
            source: "jango_plus",
            kind: "subscription_cancelled",
            billingPeriod: "monthly",
            estimatedNetRevenueKrw: 0,
            estimateConfigured: false,
          },
          {
            ownerKey: "new-subscriber",
            source: "jango_plus",
            kind: "subscription_refund",
            billingPeriod: "monthly",
            estimatedNetRevenueKrw: 0,
            estimateConfigured: false,
          },
        ]),
      },
    };

    const service = new AdminService(prisma as never);
    const overview = await service.getMonetizationOverview(
      30,
      new Date("2026-08-10T03:00:00.000Z"),
    );

    expect(overview.totals.activeSubscribers).toBe(4);
    expect(overview.totals.activeUsers).toBe(2);
    expect(overview.totals.estimatedAiCostUsd).toBe(0.02);
    expect(overview.totals.totalTokens).toBe(1800);
    expect(overview.totals.paidCreditsSold).toBe(20);
    expect(overview.totals).toMatchObject({
      periodStartSubscribers: 5,
      newSubscribers: 1,
      renewedSubscribers: 1,
      cancelledSubscribers: 1,
      refundTransactions: 1,
      renewalDecisionRatePercent: 50,
      subscriberChurnRatePercent: 20,
      refundEventSharePercent: 33.33,
    });
    expect(overview.conversion.paywallToPurchasePercent).toBe(20);
    expect(overview.conversion.rewardedAdVerificationPercent).toBe(75);
    expect(overview.usageBySource).toContainEqual({ source: "free", count: 5 });
  });

  it("uses core inventory activity for retention and evaluates unit economics", async () => {
    vi.stubEnv(
      "MONETIZATION_ESTIMATES_JSON",
      JSON.stringify({
        usdKrw: 1000,
        rewardedAdEcpmKrw: 20000,
        productNetProceedsKrw: { "apple_app_store:credits_5": 100 },
      }),
    );
    const prisma = {
      subscriptionEntitlement: { findMany: vi.fn().mockResolvedValue([]) },
      recommendationUsageEvent: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              ownerKey: "user-1",
              completedAt: new Date("2026-08-09T01:00:00.000Z"),
            },
          ]),
        groupBy: vi.fn().mockResolvedValue([
          { source: "rewarded_ad", status: "completed", _count: { _all: 1 } },
          { source: "paid_credit", status: "completed", _count: { _all: 1 } },
        ]),
      },
      recipeRecommendation: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-08-09T01:00:00.000Z"),
            estimatedCostUsd: 0.01,
            totalTokens: 1000,
            usageEvent: { source: "rewarded_ad", subscriptionEntitlement: null },
          },
          {
            createdAt: new Date("2026-08-09T02:00:00.000Z"),
            estimatedCostUsd: 0.01,
            totalTokens: 1000,
            usageEvent: { source: "paid_credit", subscriptionEntitlement: null },
          },
        ]),
      },
      monetizationFunnelEvent: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { ownerKey: "user-1", eventName: "credit_pack_viewed" },
            { ownerKey: "user-1", eventName: "credit_purchase_verified" },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      recommendationCreditPurchase: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { creditsGranted: 5 },
        }),
      },
      monetizationRevenueEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            ownerKey: "user-1",
            source: "rewarded_ad",
            kind: "rewarded_ad_impression",
            billingPeriod: null,
            estimatedNetRevenueKrw: 20,
            estimateConfigured: true,
          },
          {
            ownerKey: "user-1",
            source: "paid_credit",
            kind: "credit_purchase",
            billingPeriod: null,
            estimatedNetRevenueKrw: 100,
            estimateConfigured: true,
          },
        ]),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: "user-1", createdAt: new Date("2026-08-01T00:00:00.000Z") },
        ]),
      },
      inventoryItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            ownerKey: "user-1",
            createdByUserId: "user-1",
            updatedByUserId: "user-1",
            createdAt: new Date("2026-08-08T00:00:00.000Z"),
            updatedAt: new Date("2026-08-08T00:00:00.000Z"),
          },
        ]),
      },
    };
    const service = new AdminService(prisma as never);

    const overview = await service.getMonetizationOverview(
      30,
      new Date("2026-08-10T03:00:00.000Z"),
    );

    expect(overview.totals.activeUsers).toBe(1);
    expect(overview.retention.d7Percent).toBe(100);
    expect(overview.totals.p95AiCostPerRecommendationKrw).toBe(10);
    expect(overview.conversion.creditPackToPurchasePercent).toBe(100);
    expect(overview.unitEconomics.rewardedAd).toMatchObject({
      costCoverageMultiple: 2,
      status: "healthy",
    });
    expect(overview.unitEconomics.paidCredit).toMatchObject({
      costCoverageMultiple: 2,
      status: "review",
    });
  });
});
