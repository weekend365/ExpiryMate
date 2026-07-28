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
    subscriptionEntitlement: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    recommendationUsageEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      groupBy: vi.fn().mockResolvedValue([]),
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
  };

  return Object.assign(prisma, {
    $transaction: vi.fn(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    ),
  });
}
