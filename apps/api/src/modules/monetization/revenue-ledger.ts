import { createHash } from "node:crypto";
import {
  MonetizationRevenueEventKind,
  Prisma,
  type SubscriptionBillingPeriod,
  type SubscriptionStore,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { isStableMonetizationRolloutEnabled } from "./monetization-rollout";

type DbClient = PrismaService | Prisma.TransactionClient;

type MonetizationEstimateConfig = {
  usdKrw: number | null;
  rewardedAdEcpmKrw: number | null;
  productNetProceedsKrw: Record<string, number>;
};

export type RevenueLedgerInput = {
  ownerKey?: string | null;
  spaceId?: string | null;
  kind: MonetizationRevenueEventKind;
  source: "rewarded_ad" | "paid_credit" | "jango_plus" | "jango_household";
  store?: SubscriptionStore | null;
  productId?: string | null;
  billingPeriod?: SubscriptionBillingPeriod | null;
  basePlanId?: string | null;
  externalKey: string;
  occurredAt?: Date;
  multiplier?: 1 | -1;
};

export async function recordRevenueEvent(
  db: DbClient,
  input: RevenueLedgerInput,
) {
  if (
    !isStableMonetizationRolloutEnabled({
      subjectKey: input.ownerKey ?? input.spaceId ?? input.externalKey,
      enabledFlag: "MONETIZATION_REVENUE_LEDGER_ENABLED",
      rolloutFlag: "MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT",
      experimentKey: "monetization-revenue-ledger",
    })
  ) {
    return null;
  }
  const estimate = estimateRevenue(input);
  const externalKeyHash = hashExternalKey(input.externalKey);
  return db.monetizationRevenueEvent.upsert({
    where: { externalKeyHash },
    update: {},
    create: {
      ownerKey: input.ownerKey ?? null,
      spaceId: input.spaceId ?? null,
      kind: input.kind,
      source: input.source,
      store: input.store ?? null,
      productId: input.productId ?? null,
      billingPeriod: input.billingPeriod ?? null,
      externalKeyHash,
      estimatedNetRevenueKrw: new Prisma.Decimal(estimate.amountKrw),
      estimateConfigured: estimate.configured,
      properties: {
        estimate_version: "env-v1",
        ...(input.basePlanId ? { base_plan_id: input.basePlanId } : {}),
      },
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

export function getMonetizationEstimateConfig(): MonetizationEstimateConfig {
  const raw = process.env.MONETIZATION_ESTIMATES_JSON?.trim();
  if (!raw) return emptyConfig();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      usdKrw: positiveNumber(parsed.usdKrw),
      rewardedAdEcpmKrw: positiveNumber(parsed.rewardedAdEcpmKrw),
      productNetProceedsKrw: parseProductMap(parsed.productNetProceedsKrw),
    };
  } catch {
    return emptyConfig();
  }
}

export function validateMonetizationEstimates() {
  const raw = process.env.MONETIZATION_ESTIMATES_JSON?.trim();
  if (!raw) return false;
  const config = getMonetizationEstimateConfig();
  return (
    config.usdKrw !== null &&
    config.rewardedAdEcpmKrw !== null &&
    Object.keys(config.productNetProceedsKrw).length > 0
  );
}

function estimateRevenue(input: RevenueLedgerInput) {
  const config = getMonetizationEstimateConfig();
  let amount: number | null = null;
  if (input.kind === MonetizationRevenueEventKind.rewarded_ad_impression) {
    amount =
      config.rewardedAdEcpmKrw === null
        ? null
        : config.rewardedAdEcpmKrw / 1000;
  } else if (
    input.kind !== MonetizationRevenueEventKind.subscription_cancelled
  ) {
    const keys = [
      [input.store, input.productId, input.basePlanId].filter(Boolean).join(":"),
      [input.store, input.productId, input.billingPeriod].filter(Boolean).join(":"),
      [input.store, input.productId].filter(Boolean).join(":"),
    ];
    amount =
      keys
        .map((key) => config.productNetProceedsKrw[key])
        .find((value) => typeof value === "number") ?? null;
  } else {
    amount = 0;
  }
  return {
    configured: amount !== null,
    amountKrw:
      Math.round((amount ?? 0) * (input.multiplier ?? 1) * 100) / 100,
  };
}

function hashExternalKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function parseProductMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" &&
        Number.isFinite(entry[1]) &&
        entry[1] >= 0,
    ),
  );
}

function emptyConfig(): MonetizationEstimateConfig {
  return {
    usdKrw: null,
    rewardedAdEcpmKrw: null,
    productNetProceedsKrw: {},
  };
}
