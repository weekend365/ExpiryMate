import {
  MonetizationRevenueEventKind,
  SubscriptionStore,
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMonetizationEstimateConfig,
  recordRevenueEvent,
  validateMonetizationEstimates,
} from "./revenue-ledger";

describe("revenue ledger", () => {
  afterEach(() => {
    delete process.env.MONETIZATION_ESTIMATES_JSON;
    delete process.env.MONETIZATION_REVENUE_LEDGER_ENABLED;
    delete process.env.MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT;
  });

  it("uses an idempotent hash and configured product proceeds", async () => {
    process.env.MONETIZATION_REVENUE_LEDGER_ENABLED = "true";
    process.env.MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT = "100";
    process.env.MONETIZATION_ESTIMATES_JSON = JSON.stringify({
      usdKrw: 1350,
      rewardedAdEcpmKrw: 12000,
      productNetProceedsKrw: {
        "apple_app_store:expirymate_premium_monthly": 2730,
      },
    });
    const upsert = vi.fn().mockResolvedValue({ id: "revenue-1" });

    const db = { monetizationRevenueEvent: { upsert } } as never;
    const purchase = {
      ownerKey: "owner-a",
      kind: MonetizationRevenueEventKind.subscription_purchase,
      source: "jango_plus" as const,
      store: SubscriptionStore.apple_app_store,
      productId: "expirymate_premium_monthly",
      externalKey: "raw-store-transaction",
    };
    await recordRevenueEvent(db, purchase);
    await recordRevenueEvent(db, purchase);

    const input = upsert.mock.calls[0]?.[0];
    expect(input.where.externalKeyHash).toHaveLength(64);
    expect(input.where.externalKeyHash).not.toContain("raw-store-transaction");
    expect(upsert.mock.calls[1]?.[0].where.externalKeyHash).toBe(
      input.where.externalKeyHash,
    );
    expect(Number(input.create.estimatedNetRevenueKrw)).toBe(2730);
    expect(input.create.estimateConfigured).toBe(true);
  });

  it("records refunds as negative reversing entries", async () => {
    process.env.MONETIZATION_REVENUE_LEDGER_ENABLED = "true";
    process.env.MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT = "100";
    process.env.MONETIZATION_ESTIMATES_JSON = JSON.stringify({
      usdKrw: 1350,
      rewardedAdEcpmKrw: 12000,
      productNetProceedsKrw: {
        "apple_app_store:expirymate_premium_monthly": 2730,
      },
    });
    const upsert = vi.fn().mockResolvedValue({ id: "refund-1" });

    await recordRevenueEvent(
      { monetizationRevenueEvent: { upsert } } as never,
      {
        ownerKey: "owner-a",
        kind: MonetizationRevenueEventKind.subscription_refund,
        source: "jango_plus",
        store: SubscriptionStore.apple_app_store,
        productId: "expirymate_premium_monthly",
        externalKey: "refund-transaction",
        multiplier: -1,
      },
    );

    expect(Number(upsert.mock.calls[0]?.[0].create.estimatedNetRevenueKrw)).toBe(
      -2730,
    );
  });

  it("marks estimates unavailable instead of treating missing config as revenue", async () => {
    process.env.MONETIZATION_REVENUE_LEDGER_ENABLED = "true";
    process.env.MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT = "100";
    const upsert = vi.fn().mockResolvedValue({ id: "revenue-1" });
    await recordRevenueEvent(
      { monetizationRevenueEvent: { upsert } } as never,
      {
        kind: MonetizationRevenueEventKind.rewarded_ad_impression,
        source: "rewarded_ad",
        externalKey: "ad-1",
      },
    );

    expect(upsert.mock.calls[0]?.[0].create.estimateConfigured).toBe(false);
    expect(validateMonetizationEstimates()).toBe(false);
    expect(getMonetizationEstimateConfig().usdKrw).toBeNull();
  });
});
