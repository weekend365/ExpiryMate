import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionEntitlementResyncService } from "./subscription-entitlement-resync.service";
import { SubscriptionsService } from "./subscriptions.service";

const managedEnvKeys = [
  "SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED",
  "SUBSCRIPTION_RESYNC_INTERVAL_MINUTES",
  "SUBSCRIPTION_RESYNC_BATCH_SIZE",
] as const;

const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]]),
);

describe("SubscriptionEntitlementResyncService", () => {
  beforeEach(() => {
    restoreManagedEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreManagedEnv();
  });

  it("skips work when the scheduler flag is off", async () => {
    process.env.SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED = "false";
    const subscriptions = {
      resyncAppleEntitlements: vi.fn(),
      applyGoogleVoidedPurchases: vi.fn(),
    };
    const service = new SubscriptionEntitlementResyncService(
      { $executeRaw: vi.fn(), schedulerLease: { findUnique: vi.fn() } } as never,
      subscriptions as never,
    );

    await expect(service.runResync()).resolves.toEqual({
      skippedByFlag: true,
      skippedByLock: false,
    });
    expect(subscriptions.resyncAppleEntitlements).not.toHaveBeenCalled();
  });

  it("runs Apple resync and Google voided sync when leased", async () => {
    process.env.SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED = "true";
    const prisma = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      schedulerLease: {
        findUnique: vi.fn().mockResolvedValue({ ownerId: "will-replace" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    // Lease ownership check compares to instance UUID — stub after construct.
    const subscriptions = {
      resyncAppleEntitlements: vi.fn().mockResolvedValue({
        scanned: 2,
        updated: 1,
        failed: 0,
      }),
      applyGoogleVoidedPurchases: vi.fn().mockResolvedValue({
        subscriptionVoids: 1,
        productVoids: 0,
        entitlementsRevoked: 1,
        creditsRevoked: 0,
      }),
    };
    const service = new SubscriptionEntitlementResyncService(
      prisma as never,
      subscriptions as never,
    );
    prisma.schedulerLease.findUnique.mockImplementation(async () => ({
      ownerId: (service as unknown as { leaseOwnerId: string }).leaseOwnerId,
    }));

    const result = await service.runResync();

    expect(result).toMatchObject({
      skippedByFlag: false,
      skippedByLock: false,
      apple: { scanned: 2, updated: 1, failed: 0 },
      google: { entitlementsRevoked: 1 },
    });
    expect(subscriptions.resyncAppleEntitlements).toHaveBeenCalled();
    expect(subscriptions.applyGoogleVoidedPurchases).toHaveBeenCalled();
    expect(prisma.schedulerLease.deleteMany).toHaveBeenCalled();
  });
});

describe("SubscriptionsService Google voided revoke", () => {
  it("revokes an active Google entitlement matched by purchase token hash", async () => {
    const { createHash } = await import("node:crypto");
    const token = "voided-token";
    const hash = createHash("sha256").update(token).digest("hex");
    const existing = {
      id: "entitlement-1",
      ownerKey: "owner-a",
      spaceId: null,
      productId: "expirymate_premium_monthly",
      billingPeriod: "monthly",
      basePlanId: null,
      transactionId: "GPA.1",
      purchaseTokenHash: hash,
      isActive: true,
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      environment: "production",
      willRenew: true,
    };
    const prisma = {
      subscriptionEntitlement: {
        findUnique: vi.fn().mockResolvedValue(existing),
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(async ({ data }) => ({
          ...existing,
          ...data,
        })),
        create: vi.fn(),
      },
      recommendationCreditPurchase: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    const service = new SubscriptionsService(prisma as never);
    const privateService = service as unknown as {
      revokeGoogleEntitlementFromVoided: (voided: {
        purchaseToken?: string;
        orderId?: string;
      }) => Promise<boolean>;
    };

    await expect(
      privateService.revokeGoogleEntitlementFromVoided({
        purchaseToken: token,
        orderId: "GPA.1",
      }),
    ).resolves.toBe(true);

    expect(prisma.subscriptionEntitlement.update).toHaveBeenCalledWith({
      where: { id: "entitlement-1" },
      data: expect.objectContaining({
        isActive: false,
        status: "revoked",
        willRenew: false,
      }),
    });
  });
});

function restoreManagedEnv() {
  for (const key of managedEnvKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
