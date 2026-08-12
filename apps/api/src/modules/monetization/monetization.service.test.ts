import {
  createHmac,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import {
  RecommendationUsageSource,
  RecommendationUsageStatus,
  RewardedAdSessionStatus,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonetizationService } from "./monetization.service";

const managedEnvKeys = [
  "AUTH_TOKEN_SECRET",
  "ADMOB_SSV_USER_ID_SECRET",
  "ADMOB_IOS_REWARDED_AD_UNIT_ID",
  "ADMOB_ANDROID_REWARDED_AD_UNIT_ID",
  "REWARDED_ADS_ENABLED",
  "SUBSCRIPTIONS_ENABLED",
  "RECIPE_FREE_DAILY_LIMIT",
  "RECIPE_REWARDED_DAILY_LIMIT",
  "RECIPE_SUBSCRIBER_DAILY_LIMIT",
  "RECIPE_ABSOLUTE_DAILY_LIMIT",
  "MONETIZATION_EXPERIMENT_SALT",
  "MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT",
  "RECIPE_VALUE_FIRST_FREE_DAILY_LIMIT",
  "RECIPE_VALUE_FIRST_REWARDED_DAILY_LIMIT",
  "PERSONALIZED_MONETIZATION_OFFERS_ENABLED",
  "PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT",
  "RECIPE_HOUSEHOLD_DAILY_LIMIT",
  "HOUSEHOLD_SUBSCRIPTIONS_ENABLED",
  "HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT",
  "BARCODE_REWARDS_ENABLED",
  "BARCODE_REWARD_ROLLOUT_PERCENT",
  "BARCODE_REWARD_DAILY_LIMIT",
  "BARCODE_REWARD_BALANCE_LIMIT",
] as const;

const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]]),
);

describe("MonetizationService", () => {
  beforeEach(() => {
    process.env.REWARDED_ADS_ENABLED = "true";
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.RECIPE_FREE_DAILY_LIMIT = "1";
    process.env.RECIPE_REWARDED_DAILY_LIMIT = "3";
    process.env.RECIPE_SUBSCRIBER_DAILY_LIMIT = "30";
    process.env.RECIPE_ABSOLUTE_DAILY_LIMIT = "30";
    process.env.MONETIZATION_EXPERIMENT_SALT = "test-experiment-salt";
    process.env.MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT = "0";
    process.env.RECIPE_VALUE_FIRST_FREE_DAILY_LIMIT = "2";
    process.env.RECIPE_VALUE_FIRST_REWARDED_DAILY_LIMIT = "2";
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ENABLED = "false";
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT = "0";
    process.env.RECIPE_HOUSEHOLD_DAILY_LIMIT = "60";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED = "true";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT = "100";
    process.env.BARCODE_REWARDS_ENABLED = "true";
    process.env.BARCODE_REWARD_ROLLOUT_PERCENT = "100";
    process.env.BARCODE_REWARD_DAILY_LIMIT = "3";
    process.env.BARCODE_REWARD_BALANCE_LIMIT = "10";
    process.env.ADMOB_IOS_REWARDED_AD_UNIT_ID =
      "ca-app-pub-1234567890123456/1111111111";
    process.env.ADMOB_ANDROID_REWARDED_AD_UNIT_ID =
      "ca-app-pub-1234567890123456/2222222222";
    process.env.ADMOB_SSV_USER_ID_SECRET = "ssv-test-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const key of managedEnvKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("uses the KST day and includes reservations in the free limit", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
    ]);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus(
      "owner-a",
      new Date("2026-07-28T14:59:59.000Z"),
    );

    expect(status.day).toBe("2026-07-28");
    expect(status.resetsAt).toBe("2026-07-28T15:00:00.000Z");
    expect(status.free).toEqual({ limit: 1, used: 1, remaining: 0 });
    expect(status.rewardedAds.canWatch).toBe(true);
  });

  it("counts free and ad uses already made before a subscription starts", async () => {
    const prisma = createPrismaMock();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({
      id: "subscription-1",
      isActive: true,
    });
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
      {
        source: RecommendationUsageSource.rewarded_ad,
        _count: { _all: 3 },
      },
    ]);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus("owner-a");

    expect(status.tier).toBe("jango_plus");
    expect(status.used).toBe(4);
    expect(status.remaining).toBe(26);
    expect(status.rewardedAds.canWatch).toBe(false);
  });

  it("keeps existing Plus entitlements while subscription sales are paused", async () => {
    process.env.SUBSCRIPTIONS_ENABLED = "false";
    const prisma = createPrismaMock();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({
      id: "subscription-1",
      isActive: true,
    });
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus("owner-a");

    expect(status.subscriptionsEnabled).toBe(false);
    expect(status.tier).toBe("jango_plus");
    expect(status.remaining).toBe(30);
    expect(status.rewardedAds.canWatch).toBe(false);
  });

  it("lets free users choose a rewarded ad while preserving purchased credits", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      { source: RecommendationUsageSource.free, _count: { _all: 1 } },
    ]);
    prisma.recommendationCreditPurchase.findMany.mockResolvedValue([
      { creditsGranted: 5 },
    ]);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus("owner-a");

    expect(status.paidCredits.balance).toBe(5);
    expect(status.rewardedAds.canWatch).toBe(true);
  });

  it("isolates personal Plus usage from Household usage when switching spaces", async () => {
    const prisma = createPrismaMock();
    prisma.inventorySpace.findFirst.mockResolvedValue({
      id: "space-personal",
      type: "personal",
      ownerUserId: "owner-a",
      _count: { memberships: 1 },
    });
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({
      id: "personal-plus",
      ownerKey: "owner-a",
      spaceId: null,
      planCode: "jango_plus",
      isActive: true,
    });
    const service = new MonetizationService(prisma as never);

    await service.getStatusForSpace("owner-a", "space-personal");

    expect(prisma.recommendationUsageEvent.groupBy).toHaveBeenCalledWith({
      by: ["source"],
      where: expect.objectContaining({
        ownerKey: "owner-a",
        OR: [
          { subscriptionEntitlementId: null },
          { subscriptionEntitlementId: "personal-plus" },
        ],
      }),
      _count: { _all: true },
    });
  });

  it("assigns a stable value-first policy from the server rollout", async () => {
    process.env.MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT = "100";
    const prisma = createPrismaMock();
    const service = new MonetizationService(prisma as never);

    const first = await service.getStatus("owner-a");
    const second = await service.getStatus("owner-a");

    expect(first.experiment).toEqual({
      key: "monetization-v1",
      variant: "value_first",
      defaultBillingPeriod: "monthly",
    });
    expect(first.free.limit).toBe(2);
    expect(first.rewardedAds.dailyLimit).toBe(2);
    expect(second.experiment).toEqual(first.experiment);
  });

  it("offers Plus to engaged users after the free quota is exhausted", async () => {
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ENABLED = "true";
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT = "100";
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      { source: RecommendationUsageSource.free, _count: { _all: 1 } },
    ]);
    prisma.recommendationUsageEvent.count.mockImplementation(async (args) =>
      args?.where?.completedAt ? 3 : 0,
    );
    prisma.monetizationFunnelEvent.findMany.mockResolvedValue([
      { createdAt: new Date("2026-08-09T03:00:00.000Z") },
      { createdAt: new Date("2026-08-10T03:00:00.000Z") },
    ]);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus(
      "owner-engaged",
      new Date("2026-08-10T04:00:00.000Z"),
    );

    expect(status.offer).toMatchObject({
      kind: "jango_plus",
      reason: "engaged",
      personalized: true,
    });
  });

  it("offers Plus at an engaged value moment before the free quota is exhausted", async () => {
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ENABLED = "true";
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT = "100";
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.count.mockImplementation(async (args) =>
      args?.where?.completedAt ? 3 : 0,
    );
    prisma.monetizationFunnelEvent.findMany.mockResolvedValue([
      { createdAt: new Date("2026-08-09T03:00:00.000Z") },
      { createdAt: new Date("2026-08-10T03:00:00.000Z") },
    ]);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus(
      "owner-engaged",
      new Date("2026-08-10T04:00:00.000Z"),
    );

    expect(status.free.remaining).toBe(1);
    expect(status.offer).toMatchObject({
      kind: "jango_plus",
      reason: "engaged",
      personalized: true,
    });
  });

  it("offers Household after a second household member joins", async () => {
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ENABLED = "true";
    process.env.PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT = "100";
    const prisma = createPrismaMock();
    prisma.inventorySpace.findFirst.mockResolvedValue({
      id: "space-home",
      type: "household",
      ownerUserId: "owner-a",
      _count: { memberships: 2 },
    });
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatusForSpace(
      "owner-a",
      "space-home",
      new Date("2026-08-10T04:00:00.000Z"),
    );

    expect(status.free.remaining).toBe(1);
    expect(status.offer).toMatchObject({
      kind: "jango_household",
      reason: "engaged",
      personalized: true,
    });
  });

  it("uses the active household space entitlement and shared daily limit", async () => {
    const prisma = createPrismaMock();
    prisma.inventorySpace.findFirst.mockResolvedValue({
      id: "space-home",
      type: "household",
      ownerUserId: "owner-a",
      _count: { memberships: 3 },
    });
    prisma.subscriptionEntitlement.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "household-subscription",
        ownerKey: "owner-a",
        spaceId: "space-home",
        planCode: "jango_household",
        isActive: true,
      });
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      { source: RecommendationUsageSource.subscription, _count: { _all: 10 } },
    ]);
    prisma.recommendationUsageEvent.count.mockResolvedValue(10);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatusForSpace(
      "member-a",
      "space-home",
      new Date("2026-08-10T04:00:00.000Z"),
    );

    expect(status.tier).toBe("jango_household");
    expect(status.usageScope).toEqual({ type: "space", spaceId: "space-home" });
    expect(status.dailyLimit).toBe(60);
    expect(status.remaining).toBe(50);
    expect(status.rewardedAds.canWatch).toBe(false);
  });

  it("serializes household reservations so concurrent requests cannot exceed 60", async () => {
    const prisma = createPrismaMock();
    let householdUsage = 59;
    let transactionQueue = Promise.resolve();
    prisma.inventorySpace.findFirst.mockResolvedValue({
      id: "space-home",
      type: "household",
      ownerUserId: "owner-a",
      _count: { memberships: 3 },
    });
    prisma.subscriptionEntitlement.findFirst.mockImplementation(
      async (query: { where?: { planCode?: string } }) =>
        query.where?.planCode === "jango_household"
          ? {
              id: "household-subscription",
              ownerKey: "owner-a",
              spaceId: "space-home",
              planCode: "jango_household",
              isActive: true,
            }
          : null,
    );
    prisma.recommendationUsageEvent.groupBy.mockImplementation(async () => [
      {
        source: RecommendationUsageSource.subscription,
        _count: { _all: householdUsage },
      },
    ]);
    prisma.recommendationUsageEvent.count.mockImplementation(
      async (query: { where?: { subscriptionEntitlementId?: string } }) =>
        query.where?.subscriptionEntitlementId ? householdUsage : 0,
    );
    prisma.recommendationUsageEvent.create.mockImplementation(async () => {
      householdUsage += 1;
      return { id: `usage-${householdUsage}` };
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => {
        const result = transactionQueue.then(() => callback(prisma));
        transactionQueue = result.then(() => undefined, () => undefined);
        return result;
      },
    );
    const service = new MonetizationService(prisma as never);

    const results = await Promise.allSettled([
      service.reserveRecommendation("member-a", "request-a", new Date(), "space-home"),
      service.reserveRecommendation("member-b", "request-b", new Date(), "space-home"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(householdUsage).toBe(60);
  });

  it("subtracts paid-credit usage across all previous days", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationCreditPurchase.findMany.mockResolvedValue([
      { creditsGranted: 5 },
    ]);
    prisma.recommendationUsageEvent.count.mockResolvedValue(3);
    const service = new MonetizationService(prisma as never);

    const status = await service.getStatus("owner-a");

    expect(status.paidCredits.balance).toBe(2);
    expect(prisma.recommendationUsageEvent.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ownerKey: "owner-a",
        source: RecommendationUsageSource.paid_credit,
      }),
    });
  });

  it("stores only allow-listed funnel event data with the assigned variant", async () => {
    const prisma = createPrismaMock();
    const service = new MonetizationService(prisma as never);

    await service.trackFunnelEvent("owner-a", {
      event: "paywall_viewed",
      properties: { source: "settings" },
    });

    expect(prisma.monetizationFunnelEvent.create).toHaveBeenCalledWith({
      data: {
        ownerKey: "owner-a",
        eventName: "paywall_viewed",
        experimentKey: "monetization-v1",
        experimentVariant: "control",
        properties: { source: "settings" },
      },
    });
  });

  it("records a recommendation screen view at most once per KST day", async () => {
    const prisma = createPrismaMock();
    prisma.monetizationFunnelEvent.count.mockResolvedValue(1);
    const service = new MonetizationService(prisma as never);

    await service.trackFunnelEvent("owner-a", {
      event: "recommendation_screen_viewed",
    });

    expect(prisma.monetizationFunnelEvent.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
  });

  it("returns a completed recommendation for a duplicate idempotency key", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.findUnique.mockResolvedValue({
      id: "usage-1",
      status: RecommendationUsageStatus.completed,
      recommendationId: "recommendation-1",
    });
    const service = new MonetizationService(prisma as never);

    await expect(
      service.reserveRecommendation("owner-a", "same-key"),
    ).resolves.toEqual({
      kind: "existing",
      recommendationId: "recommendation-1",
    });
    expect(prisma.recommendationUsageEvent.create).not.toHaveBeenCalled();
  });

  it("reserves free usage first and releases it after generation failure", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.create.mockResolvedValue({ id: "usage-1" });
    const service = new MonetizationService(prisma as never);

    await expect(
      service.reserveRecommendation("owner-a", "new-key"),
    ).resolves.toEqual({ kind: "reserved", usageEventId: "usage-1" });
    expect(prisma.recommendationUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKey: "owner-a",
        source: RecommendationUsageSource.free,
        status: RecommendationUsageStatus.reserved,
      }),
    });

    await service.releaseRecommendation("usage-1", "upstream_error");
    expect(prisma.recommendationUsageEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: "usage-1",
        status: RecommendationUsageStatus.reserved,
      },
      data: expect.objectContaining({
        status: RecommendationUsageStatus.released,
        rewardedAdSessionId: null,
        barcodeRewardCreditId: null,
        paidCreditPurchaseId: null,
        releaseReason: "upstream_error",
      }),
    });
  });

  it("enforces the absolute daily safety limit", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.subscription,
        _count: { _all: 30 },
      },
    ]);
    const service = new MonetizationService(prisma as never);

    await expect(
      service.reserveRecommendation("owner-a", "over-limit"),
    ).rejects.toMatchObject({
      errorCode: "RECIPE_SERVICE_CAPACITY_REACHED",
    });
  });

  it("uses an available ad credit before a barcode credit", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
    ]);
    prisma.rewardedAdSession.findFirst.mockResolvedValue({ id: "ad-1" });
    prisma.barcodeRewardCredit.count.mockResolvedValue(1);
    prisma.barcodeRewardCredit.findFirst.mockResolvedValue({ id: "barcode-1" });
    prisma.recommendationUsageEvent.create.mockResolvedValue({ id: "usage-1" });
    const service = new MonetizationService(prisma as never);

    await service.reserveRecommendation("owner-a", "ad-key");

    expect(prisma.recommendationUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: RecommendationUsageSource.rewarded_ad,
        rewardedAdSessionId: "ad-1",
        barcodeRewardCreditId: null,
      }),
    });
    expect(prisma.barcodeRewardCredit.findFirst).not.toHaveBeenCalled();
  });

  it("uses an earned ad credit before a purchased credit", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
    ]);
    prisma.recommendationCreditPurchase.findMany.mockResolvedValueOnce([
      { creditsGranted: 5 },
    ]);
    prisma.rewardedAdSession.findFirst.mockResolvedValue({ id: "ad-1" });
    prisma.barcodeRewardCredit.count.mockResolvedValue(1);
    prisma.recommendationUsageEvent.create.mockResolvedValue({ id: "usage-1" });
    const service = new MonetizationService(prisma as never);

    await service.reserveRecommendation("owner-a", "paid-key");

    expect(prisma.recommendationUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: RecommendationUsageSource.rewarded_ad,
        paidCreditPurchaseId: null,
        rewardedAdSessionId: "ad-1",
        barcodeRewardCreditId: null,
      }),
    });
    expect(prisma.recommendationCreditPurchase.findMany).toHaveBeenCalledTimes(1);
  });

  it("uses a purchased credit when no earned ad credit is available", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
    ]);
    prisma.recommendationCreditPurchase.findMany
      .mockResolvedValueOnce([{ creditsGranted: 5 }])
      .mockResolvedValueOnce([
        {
          id: "purchase-1",
          creditsGranted: 5,
          _count: { usageEvents: 0 },
        },
      ]);
    prisma.recommendationUsageEvent.create.mockResolvedValue({ id: "usage-1" });
    const service = new MonetizationService(prisma as never);

    await service.reserveRecommendation("owner-a", "paid-key");

    expect(prisma.recommendationUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: RecommendationUsageSource.paid_credit,
        paidCreditPurchaseId: "purchase-1",
        rewardedAdSessionId: null,
      }),
    });
    expect(prisma.monetizationFunnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "paid_credit_used" }),
    });
  });

  it("falls back to a barcode credit after free and ad credits", async () => {
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
    ]);
    prisma.barcodeRewardCredit.count.mockResolvedValue(1);
    prisma.barcodeRewardCredit.findFirst.mockResolvedValue({ id: "barcode-1" });
    prisma.recommendationUsageEvent.create.mockResolvedValue({ id: "usage-1" });
    const service = new MonetizationService(prisma as never);

    await service.reserveRecommendation("owner-a", "barcode-key");

    expect(prisma.rewardedAdSession.findFirst).toHaveBeenCalled();
    expect(prisma.recommendationUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: RecommendationUsageSource.barcode_contribution,
        barcodeRewardCreditId: "barcode-1",
      }),
    });
    expect(prisma.monetizationFunnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "barcode_reward_used" }),
    });
  });

  it("preserves barcode credits while a subscription is active", async () => {
    const prisma = createPrismaMock();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({
      id: "subscription-1",
      isActive: true,
    });
    prisma.barcodeRewardCredit.count.mockResolvedValue(2);
    prisma.recommendationUsageEvent.create.mockResolvedValue({ id: "usage-1" });
    const service = new MonetizationService(prisma as never);

    await service.reserveRecommendation("owner-a", "subscription-key");

    expect(prisma.recommendationUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: RecommendationUsageSource.subscription,
        barcodeRewardCreditId: null,
      }),
    });
    expect(prisma.barcodeRewardCredit.findFirst).not.toHaveBeenCalled();
  });

  it("creates 15-minute display and 24-hour verification windows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T00:00:00.000Z"));
    const prisma = createPrismaMock();
    prisma.recommendationUsageEvent.groupBy.mockResolvedValue([
      {
        source: RecommendationUsageSource.free,
        _count: { _all: 1 },
      },
    ]);
    prisma.rewardedAdSession.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ad-session-1",
        ...data,
      }),
    );
    const service = new MonetizationService(prisma as never);

    const session = await service.createRewardedAdSession("owner-a", "ios");

    expect(session.showExpiresAt).toBe("2026-07-28T00:15:00.000Z");
    expect(session.verificationExpiresAt).toBe("2026-07-29T00:00:00.000Z");
    expect(session.customData).toBe("ad-session-1");
    vi.useRealTimers();
  });

  it("verifies an AdMob ECDSA callback and stores the transaction once", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const publicDer = publicKey.export({ format: "der", type: "spki" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          keys: [{ keyId: 7, base64: publicDer.toString("base64") }],
        }),
      }),
    );

    const ownerKey = "owner-a";
    const userId = createHmac("sha256", "ssv-test-secret")
      .update(ownerKey)
      .digest("hex");
    const signedContent = [
      "ad_network=google",
      "ad_unit=1111111111",
      "custom_data=ad-session-1",
      "reward_amount=1",
      "reward_item=recipe_generation",
      "transaction_id=transaction-1",
      `user_id=${userId}`,
    ].join("&");
    const signature = sign(
      "sha256",
      Buffer.from(signedContent),
      privateKey,
    ).toString("base64url");
    const originalUrl =
      `/monetization/admob/ssv?${signedContent}` +
      `&signature=${signature}&key_id=7`;
    const query = Object.fromEntries(
      new URL(`https://example.com${originalUrl}`).searchParams,
    );
    const prisma = createPrismaMock();
    prisma.rewardedAdSession.findUnique.mockImplementation(
      async ({ where }: { where: { transactionId?: string; id?: string } }) => {
        if (where.transactionId) return null;
        return {
          id: "ad-session-1",
          ownerKey,
          adUnitId: "1111111111",
          status: RewardedAdSessionStatus.pending,
          createdAt: new Date(),
          verificationExpiresAt: new Date(Date.now() + 60_000),
        };
      },
    );
    const service = new MonetizationService(prisma as never);

    await expect(service.verifyAdMobReward(originalUrl, query)).resolves.toEqual({
      ok: true,
    });
    expect(prisma.rewardedAdSession.update).toHaveBeenCalledWith({
      where: { id: "ad-session-1" },
      data: expect.objectContaining({
        status: RewardedAdSessionStatus.verified,
        transactionId: "transaction-1",
      }),
    });
  });
});

function createPrismaMock() {
  const prisma = {
    inventorySpace: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    subscriptionEntitlement: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    recommendationUsageEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rewardedAdSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    barcodeRewardCredit: {
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    recommendationCreditPurchase: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    monetizationFunnelEvent: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
  };

  return Object.assign(prisma, {
    $transaction: vi.fn(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    ),
  });
}
