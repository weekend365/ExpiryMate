import {
  Prisma,
  RecommendationUsageSource,
  RecommendationUsageStatus,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { getMonetizationEstimateConfig } from "./revenue-ledger";

type DbClient = PrismaService | Prisma.TransactionClient;
type GuardrailStatus =
  | "disabled"
  | "learning"
  | "healthy"
  | "blocked"
  | "unconfigured";

export type UnitEconomicsAvailability = {
  rewardedAds: {
    allowed: boolean;
    status: GuardrailStatus;
    coverageMultiple: number | null;
  };
  paidCredits: {
    allowed: boolean;
    status: GuardrailStatus;
    coverageMultiple: number | null;
  };
  subscriptions: {
    allowed: boolean;
    status: GuardrailStatus;
    projectedMonthlyCostKrw: number | null;
    budgetKrw: number;
    recipeSamples: number;
    photoSamples: number;
  };
  subscriptionDailyLimitCaps: {
    subscriber: number | null;
    household: number | null;
  };
};

const ALLOWED: UnitEconomicsAvailability = {
  rewardedAds: { allowed: true, status: "disabled", coverageMultiple: null },
  paidCredits: { allowed: true, status: "disabled", coverageMultiple: null },
  subscriptions: {
    allowed: true,
    status: "disabled",
    projectedMonthlyCostKrw: null,
    budgetKrw: 858,
    recipeSamples: 0,
    photoSamples: 0,
  },
  subscriptionDailyLimitCaps: { subscriber: null, household: null },
};

let cache:
  | { expiresAt: number; value: UnitEconomicsAvailability }
  | undefined;

export async function getUnitEconomicsAvailability(
  db: DbClient,
  now = new Date(),
): Promise<UnitEconomicsAvailability> {
  if (!isEnabled("MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED")) {
    return ALLOWED;
  }
  if (cache && cache.expiresAt > now.getTime()) return cache.value;

  const estimates = getMonetizationEstimateConfig();
  if (estimates.usdKrw === null) {
    return allowWithStatus("unconfigured");
  }

  const lookbackDays = readPositiveInteger(
    "MONETIZATION_GUARDRAIL_LOOKBACK_DAYS",
    30,
  );
  const minimumSamples = readPositiveInteger(
    "MONETIZATION_GUARDRAIL_MIN_SAMPLES",
    50,
  );
  const from = new Date(now.getTime() - lookbackDays * 86_400_000);
  const [recommendations, photoParses, revenueEvents, creditPurchases] =
    await Promise.all([
    db.recipeRecommendation.findMany({
      where: {
        createdAt: { gte: from, lte: now },
        usageEvent: {
          is: {
            status: RecommendationUsageStatus.completed,
          },
        },
      },
      select: {
        estimatedCostUsd: true,
        usageEvent: { select: { source: true } },
      },
    }),
    db.inventoryPhotoParseEvent.findMany({
      where: {
        createdAt: { gte: from, lte: now },
        status: "succeeded",
      },
      select: { estimatedCostUsd: true, usageSource: true },
    }),
    db.monetizationRevenueEvent.findMany({
      where: {
        occurredAt: { gte: from, lte: now },
        source: { in: ["rewarded_ad", "paid_credit"] },
        estimateConfigured: true,
      },
      select: {
        source: true,
        estimatedNetRevenueKrw: true,
      },
    }),
    db.recommendationCreditPurchase.aggregate({
      where: { createdAt: { gte: from, lte: now } },
      _sum: { creditsGranted: true },
    }),
  ]);

  const costs = new Map<string, { amountKrw: number; units: number }>();
  const allRecommendationCostsKrw: number[] = [];
  for (const row of recommendations) {
    const source = row.usageEvent?.source;
    if (!source) continue;
    const current = costs.get(source) ?? { amountKrw: 0, units: 0 };
    const amountKrw = Number(row.estimatedCostUsd) * estimates.usdKrw;
    current.amountKrw += amountKrw;
    current.units += 1;
    costs.set(source, current);
    if (Number.isFinite(amountKrw) && amountKrw >= 0) {
      allRecommendationCostsKrw.push(amountKrw);
    }
  }
  const photoCostsKrw: number[] = [];
  for (const row of photoParses) {
    const amountKrw = Number(row.estimatedCostUsd) * estimates.usdKrw;
    if (Number.isFinite(amountKrw) && amountKrw >= 0) {
      photoCostsKrw.push(amountKrw);
    }
    if (row.usageSource === "rewarded_ad") {
      const current = costs.get(RecommendationUsageSource.rewarded_ad) ?? {
        amountKrw: 0,
        units: 0,
      };
      current.amountKrw += amountKrw;
      current.units += 1;
      costs.set(RecommendationUsageSource.rewarded_ad, current);
    }
  }

  const revenues = new Map<string, { amountKrw: number; events: number }>();
  for (const row of revenueEvents) {
    const current = revenues.get(row.source) ?? { amountKrw: 0, events: 0 };
    current.amountKrw += Number(row.estimatedNetRevenueKrw);
    current.events += 1;
    revenues.set(row.source, current);
  }

  const rewarded = buildGate({
    revenue: revenues.get("rewarded_ad")?.amountKrw ?? 0,
    revenueUnits: revenues.get("rewarded_ad")?.events ?? 0,
    cost: costs.get(RecommendationUsageSource.rewarded_ad)?.amountKrw ?? 0,
    costUnits: costs.get(RecommendationUsageSource.rewarded_ad)?.units ?? 0,
    minimumSamples,
    target: readPositiveNumber("REWARDED_AD_COST_COVERAGE_TARGET", 1),
  });
  const paidCredits = buildGate({
    revenue: revenues.get("paid_credit")?.amountKrw ?? 0,
    revenueUnits: creditPurchases._sum.creditsGranted ?? 0,
    cost: costs.get(RecommendationUsageSource.paid_credit)?.amountKrw ?? 0,
    costUnits: costs.get(RecommendationUsageSource.paid_credit)?.units ?? 0,
    minimumSamples,
    target: readPositiveNumber("PAID_CREDIT_COST_COVERAGE_TARGET", 3),
  });
  const p95AiCostKrw = percentile(allRecommendationCostsKrw, 0.95);
  const p95PhotoCostKrw = percentile(photoCostsKrw, 0.95);
  const subscriptionBudgetKrw = readPositiveNumber(
    "MONETIZATION_SUBSCRIPTION_MONTHLY_AI_BUDGET_KRW",
    858,
  );
  const hasSubscriptionSamples =
    allRecommendationCostsKrw.length >= minimumSamples &&
    photoCostsKrw.length >= readPositiveInteger(
      "MONETIZATION_GUARDRAIL_MIN_PHOTO_SAMPLES",
      30,
    );
  const projectedMonthlyCostKrw =
    p95AiCostKrw !== null && p95PhotoCostKrw !== null
      ? Math.round((60 * p95AiCostKrw + 30 * p95PhotoCostKrw) * 100) / 100
      : null;
  const subscriptions = {
    allowed:
      hasSubscriptionSamples &&
      projectedMonthlyCostKrw !== null &&
      projectedMonthlyCostKrw <= subscriptionBudgetKrw,
    status: !hasSubscriptionSamples
      ? ("learning" as const)
      : projectedMonthlyCostKrw !== null &&
          projectedMonthlyCostKrw <= subscriptionBudgetKrw
        ? ("healthy" as const)
        : ("blocked" as const),
    projectedMonthlyCostKrw,
    budgetKrw: subscriptionBudgetKrw,
    recipeSamples: allRecommendationCostsKrw.length,
    photoSamples: photoCostsKrw.length,
  };
  const subscriptionDailyLimitCaps =
    allRecommendationCostsKrw.length >= minimumSamples && p95AiCostKrw !== null
      ? {
          subscriber: budgetLimit(
            process.env.MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW,
            p95AiCostKrw,
          ),
          household: budgetLimit(
            process.env.MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW,
            p95AiCostKrw,
          ),
        }
      : { subscriber: null, household: null };
  const value = {
    rewardedAds: rewarded,
    paidCredits,
    subscriptions,
    subscriptionDailyLimitCaps,
  };
  const cacheSeconds = readPositiveInteger(
    "MONETIZATION_GUARDRAIL_CACHE_SECONDS",
    300,
  );
  cache = { expiresAt: now.getTime() + cacheSeconds * 1000, value };
  return value;
}

export function resetUnitEconomicsGuardrailCache() {
  cache = undefined;
}

function buildGate(input: {
  revenue: number;
  revenueUnits: number;
  cost: number;
  costUnits: number;
  minimumSamples: number;
  target: number;
}) {
  if (
    input.revenueUnits < input.minimumSamples ||
    input.costUnits < input.minimumSamples
  ) {
    return { allowed: true, status: "learning" as const, coverageMultiple: null };
  }
  const revenuePerUnit = input.revenue / input.revenueUnits;
  const costPerUnit = input.cost / input.costUnits;
  const coverageMultiple =
    costPerUnit > 0
      ? Math.round((revenuePerUnit / costPerUnit) * 100) / 100
      : null;
  const allowed = coverageMultiple !== null && coverageMultiple >= input.target;
  return {
    allowed,
    status: allowed ? ("healthy" as const) : ("blocked" as const),
    coverageMultiple,
  };
}

function allowWithStatus(status: GuardrailStatus): UnitEconomicsAvailability {
  return {
    rewardedAds: { allowed: true, status, coverageMultiple: null },
    paidCredits: { allowed: true, status, coverageMultiple: null },
    subscriptions: {
      allowed: true,
      status,
      projectedMonthlyCostKrw: null,
      budgetKrw: 858,
      recipeSamples: 0,
      photoSamples: 0,
    },
    subscriptionDailyLimitCaps: { subscriber: null, household: null },
  };
}

function budgetLimit(rawBudget: string | undefined, p95AiCostKrw: number) {
  const budget = Number(rawBudget);
  if (!Number.isFinite(budget) || budget <= 0 || p95AiCostKrw <= 0) return null;
  return Math.max(1, Math.floor(budget / p95AiCostKrw));
}

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index] ?? null;
}

function isEnabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readPositiveNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
