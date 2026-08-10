import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getUnitEconomicsAvailability,
  resetUnitEconomicsGuardrailCache,
} from "./unit-economics-guardrail";

const ENV_KEYS = [
  "MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED",
  "MONETIZATION_ESTIMATES_JSON",
  "MONETIZATION_GUARDRAIL_MIN_SAMPLES",
  "REWARDED_AD_COST_COVERAGE_TARGET",
  "PAID_CREDIT_COST_COVERAGE_TARGET",
  "MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW",
  "MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  resetUnitEconomicsGuardrailCache();
});

describe("getUnitEconomicsAvailability", () => {
  it("does not query economics data while the guardrail is disabled", async () => {
    const prisma = createPrisma();

    await expect(getUnitEconomicsAvailability(prisma as never)).resolves.toMatchObject({
      rewardedAds: { allowed: true, status: "disabled" },
      paidCredits: { allowed: true, status: "disabled" },
    });
    expect(prisma.recipeRecommendation.findMany).not.toHaveBeenCalled();
  });

  it("keeps offers available while the minimum sample is still accumulating", async () => {
    enableGuardrail();
    process.env.MONETIZATION_GUARDRAIL_MIN_SAMPLES = "10";
    const prisma = createPrisma({
      recommendations: [recommendation("rewarded_ad", 0.002)],
      revenueEvents: [revenue("rewarded_ad", 1)],
      creditsGranted: 1,
    });

    await expect(getUnitEconomicsAvailability(prisma as never)).resolves.toMatchObject({
      rewardedAds: { allowed: true, status: "learning" },
      paidCredits: { allowed: true, status: "learning" },
    });
  });

  it("blocks only the source that misses its configured coverage target", async () => {
    enableGuardrail();
    process.env.MONETIZATION_GUARDRAIL_MIN_SAMPLES = "2";
    process.env.MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW = "6";
    process.env.MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW = "10";
    const prisma = createPrisma({
      recommendations: [
        recommendation("rewarded_ad", 0.002),
        recommendation("rewarded_ad", 0.002),
        recommendation("paid_credit", 0.002),
        recommendation("paid_credit", 0.002),
      ],
      revenueEvents: [
        revenue("rewarded_ad", 1),
        revenue("rewarded_ad", 1),
        revenue("paid_credit", 20),
      ],
      creditsGranted: 2,
    });

    await expect(getUnitEconomicsAvailability(prisma as never)).resolves.toEqual({
      rewardedAds: {
        allowed: false,
        status: "blocked",
        coverageMultiple: 0.5,
      },
      paidCredits: {
        allowed: true,
        status: "healthy",
        coverageMultiple: 5,
      },
      subscriptionDailyLimitCaps: {
        subscriber: 3,
        household: 5,
      },
    });
  });
});

function enableGuardrail() {
  process.env.MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED = "true";
  process.env.MONETIZATION_ESTIMATES_JSON = JSON.stringify({
    usdKrw: 1000,
    rewardedAdEcpmKrw: 1000,
    productNetProceedsKrw: { credits_5: 1000 },
  });
}

function recommendation(source: "rewarded_ad" | "paid_credit", costUsd: number) {
  return { estimatedCostUsd: costUsd, usageEvent: { source } };
}

function revenue(source: "rewarded_ad" | "paid_credit", amountKrw: number) {
  return { source, estimatedNetRevenueKrw: amountKrw };
}

function createPrisma(input?: {
  recommendations?: ReturnType<typeof recommendation>[];
  revenueEvents?: ReturnType<typeof revenue>[];
  creditsGranted?: number;
}) {
  return {
    recipeRecommendation: {
      findMany: vi.fn().mockResolvedValue(input?.recommendations ?? []),
    },
    monetizationRevenueEvent: {
      findMany: vi.fn().mockResolvedValue(input?.revenueEvents ?? []),
    },
    recommendationCreditPurchase: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { creditsGranted: input?.creditsGranted ?? 0 },
      }),
    },
  };
}
