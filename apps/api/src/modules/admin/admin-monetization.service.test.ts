import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMonetizationService } from "./admin-monetization.service";

function emptyPrisma() {
  return {
    subscriptionEntitlement: { findMany: vi.fn().mockResolvedValue([]) },
    recommendationUsageEvent: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    recipeRecommendation: { findMany: vi.fn().mockResolvedValue([]) },
    monetizationFunnelEvent: { findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    recommendationCreditPurchase: { aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { creditsGranted: null } }) },
    inventoryItem: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe("Admin monetization reporting boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [7, 7, "2026-08-25T15:00:00.000Z"],
    [30, 30, "2026-08-02T15:00:00.000Z"],
    [90, 90, "2026-06-03T15:00:00.000Z"],
    [0, 30, "2026-08-02T15:00:00.000Z"],
    [Number.NaN, 30, "2026-08-02T15:00:00.000Z"],
  ])("preserves requested period %s and its KST boundary", async (requested, days, from) => {
    vi.stubEnv("MONETIZATION_ESTIMATES_JSON", "");
    const prisma = emptyPrisma();
    const now = new Date("2026-08-31T15:00:00.000Z");
    const result = await new AdminMonetizationService(prisma as never).getMonetizationOverview(Number(requested), now);
    expect(result.period).toEqual({ days, from, to: now.toISOString() });
    expect(result.daily).toHaveLength(Number(days));
    expect(prisma.recipeRecommendation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { gte: new Date(from), lte: now } },
    }));
  });

  it("keeps missing estimates distinct from zero revenue and empty activity", async () => {
    vi.stubEnv("MONETIZATION_ESTIMATES_JSON", "");
    const result = await new AdminMonetizationService(emptyPrisma() as never).getMonetizationOverview(7, new Date("2026-08-31T15:00:00.000Z"));
    expect(result.totals).toMatchObject({ activeUsers: 0, activeSubscribers: 0, paidCreditsSold: 0, estimatedNetRevenueKrw: null, p95AiCostPerRecommendationKrw: null });
    expect(result.retention).toEqual({ d7Percent: 0, d30Percent: 0, cohorts: [] });
    expect(result.unitEconomics.rewardedAd.status).toBe("unconfigured");
    expect(result.conversion).toEqual({ paywallToPurchasePercent: 0, rewardedAdVerificationPercent: 0, barcodeRewardGrantPercent: 0, creditPackToPurchasePercent: 0 });
  });

  it("propagates a query failure instead of returning misleading zero totals", async () => {
    const prisma = emptyPrisma();
    const failure = new Error("database unavailable");
    prisma.recipeRecommendation.findMany.mockRejectedValue(failure);
    await expect(new AdminMonetizationService(prisma as never).getMonetizationOverview()).rejects.toBe(failure);
  });
});
