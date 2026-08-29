import { ServiceUnavailableException } from "@nestjs/common";
import {
  InventoryPhotoParseUsageSource,
  Prisma,
  RewardedAdPurpose,
} from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryPhotoParsePolicyService } from "./inventory-photo-parse.policy";

const envKeys = [
  "INVENTORY_PHOTO_PARSE_ENABLED",
  "REWARDED_ADS_ENABLED",
  "INVENTORY_PHOTO_PARSE_REWARDED_ADS_ENABLED",
  "INVENTORY_PHOTO_PARSE_FREE_DAILY_LIMIT",
  "INVENTORY_PHOTO_PARSE_REWARDED_DAILY_LIMIT",
  "INVENTORY_PHOTO_PARSE_SUBSCRIBER_DAILY_LIMIT",
  "INVENTORY_PHOTO_PARSE_SUBSCRIBER_MONTHLY_LIMIT",
  "INVENTORY_PHOTO_PARSE_DAILY_COST_LIMIT_USD",
] as const;

describe("InventoryPhotoParsePolicyService", () => {
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );

  beforeEach(() => {
    process.env.REWARDED_ADS_ENABLED = "true";
    process.env.INVENTORY_PHOTO_PARSE_REWARDED_ADS_ENABLED = "true";
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("allows parse by default", () => {
    delete process.env.INVENTORY_PHOTO_PARSE_ENABLED;
    const policy = new InventoryPhotoParsePolicyService({} as never);
    expect(() => policy.ensureEnabled()).not.toThrow();
  });

  it("blocks parse for explicit kill-switch values", () => {
    for (const value of ["false", "0", "off", " OFF "]) {
      process.env.INVENTORY_PHOTO_PARSE_ENABLED = value;
      const policy = new InventoryPhotoParsePolicyService({} as never);
      expect(() => policy.ensureEnabled()).toThrow(ServiceUnavailableException);
    }
  });

  it("reserves the first request as the KST daily free use", async () => {
    const prisma = createPrismaMock();
    prisma.inventoryPhotoParseEvent.count.mockResolvedValue(0);
    prisma.rewardedAdSession.count.mockResolvedValue(0);
    prisma.inventoryPhotoParseEvent.create.mockResolvedValue({ id: "event-1" });
    const policy = new InventoryPhotoParsePolicyService(prisma as never);
    const now = new Date("2026-08-28T01:00:00.000Z");

    await expect(policy.reserveParse(reservationInput(now))).resolves.toEqual({
      kind: "reserved",
      eventId: "event-1",
    });
    expect(prisma.inventoryPhotoParseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usageSource: InventoryPhotoParseUsageSource.free,
        usageDay: new Date("2026-08-28T00:00:00.000Z"),
        rewardedAdSessionId: null,
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("consumes only an inventory-photo verified reward after the free use", async () => {
    const prisma = createPrismaMock();
    prisma.inventoryPhotoParseEvent.count.mockResolvedValue(1);
    prisma.rewardedAdSession.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.rewardedAdSession.findFirst.mockResolvedValue({ id: "photo-ad-1" });
    prisma.inventoryPhotoParseEvent.create.mockResolvedValue({ id: "event-2" });
    const policy = new InventoryPhotoParsePolicyService(prisma as never);

    await policy.reserveParse(reservationInput(new Date("2026-08-28T05:00:00Z")));

    expect(prisma.rewardedAdSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          purpose: RewardedAdPurpose.inventory_photo_parse,
          photoParseEvent: { is: null },
        }),
      }),
    );
    expect(prisma.inventoryPhotoParseEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usageSource: InventoryPhotoParseUsageSource.rewarded_ad,
        rewardedAdSessionId: "photo-ad-1",
      }),
    });
  });

  it("returns the daily-limit code after three verified photo ads", async () => {
    const prisma = createPrismaMock();
    prisma.inventoryPhotoParseEvent.count.mockResolvedValue(1);
    prisma.rewardedAdSession.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);
    const policy = new InventoryPhotoParsePolicyService(prisma as never);

    await expect(
      policy.reserveParse(reservationInput(new Date("2026-08-28T05:00:00Z"))),
    ).rejects.toMatchObject({
      status: 429,
      errorCode: "PHOTO_PARSE_DAILY_LIMIT_REACHED",
    });
  });

  it("uses a user-scoped monthly and daily quota for active Plus", async () => {
    process.env.INVENTORY_PHOTO_PARSE_SUBSCRIBER_DAILY_LIMIT = "3";
    process.env.INVENTORY_PHOTO_PARSE_SUBSCRIBER_MONTHLY_LIMIT = "30";
    const prisma = createPrismaMock();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({
      id: "plus-1",
    });
    prisma.inventoryPhotoParseEvent.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(12);
    prisma.rewardedAdSession.count.mockResolvedValue(0);
    const policy = new InventoryPhotoParsePolicyService(prisma as never);

    const access = await policy.getAccess(
      "owner-a",
      new Date("2026-08-28T05:00:00Z"),
    );

    expect(access).toMatchObject({
      tier: "jango_plus",
      usageSource: "subscription",
      canParse: true,
      subscriptionQuota: {
        monthly: { limit: 30, used: 12, remaining: 18 },
        daily: { limit: 3, used: 2, remaining: 1 },
      },
      rewardedAds: { enabled: false, canWatch: false },
    });
  });

  it("does not lower an active Plus allowance with the free-user cost cap", async () => {
    process.env.INVENTORY_PHOTO_PARSE_DAILY_COST_LIMIT_USD = "0.01";
    const prisma = createPrismaMock();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({ id: "plus-1" });
    const policy = new InventoryPhotoParsePolicyService(prisma as never);

    await expect(
      policy.enforceDailyCostLimit(
        "owner-a",
        0.04,
        new Date("2026-08-28T05:00:00Z"),
      ),
    ).resolves.toBeUndefined();
    expect(prisma.inventoryPhotoParseEvent.aggregate).not.toHaveBeenCalled();
  });

  it("replays an unexpired result for the same idempotency key", async () => {
    const prisma = createPrismaMock();
    prisma.inventoryPhotoParseEvent.findUnique.mockResolvedValue({
      status: "succeeded",
      resultPayload: { scene: "receipt", items: [] },
      resultExpiresAt: new Date("2026-08-29T05:00:00Z"),
    });
    const policy = new InventoryPhotoParsePolicyService(prisma as never);

    await expect(
      policy.reserveParse(reservationInput(new Date("2026-08-28T05:00:00Z"))),
    ).resolves.toEqual({
      kind: "existing",
      result: { scene: "receipt", items: [] },
    });
    expect(prisma.inventoryPhotoParseEvent.create).not.toHaveBeenCalled();
  });

  it("returns the ad credit when AI generation fails while retaining cost", async () => {
    const prisma = createPrismaMock();
    const policy = new InventoryPhotoParsePolicyService(prisma as never);

    await policy.failParse("event-1", {
      failureCode: "provider_error",
      durationMs: 100,
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 20,
      totalTokens: 120,
      estimatedCostUsd: new Prisma.Decimal("0.01"),
    });

    expect(prisma.inventoryPhotoParseEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        status: "failed",
        rewardedAdSessionId: null,
        estimatedCostUsd: new Prisma.Decimal("0.01"),
      }),
    });
  });
});

function reservationInput(now: Date) {
  return {
    ownerKey: "owner-a",
    spaceId: "space-a",
    scene: "receipt",
    aiModel: "gpt-5.6-luna",
    promptVersion: "test-v1",
    projectedCostUsd: 0.04,
    idempotencyKey: "request-a",
    now,
  };
}

function createPrismaMock() {
  const prisma = {
    subscriptionEntitlement: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    inventoryPhotoParseEvent: {
      count: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({
        _sum: { estimatedCostUsd: 0, reservedCostUsd: 0 },
      }),
    },
    rewardedAdSession: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
  );
  return prisma;
}
