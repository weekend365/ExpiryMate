import { generateKeyPairSync } from "node:crypto";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsService } from "./subscriptions.service";

const managedEnvKeys = [
  "NODE_ENV",
  "IAP_ALLOWED_PRODUCT_IDS",
  "IAP_ALLOW_SANDBOX_PURCHASES",
  "APPLE_APP_STORE_ISSUER_ID",
  "APPLE_APP_STORE_KEY_ID",
  "APPLE_BUNDLE_ID",
  "APPLE_APP_STORE_PRIVATE_KEY",
  "APPLE_APP_STORE_ENVIRONMENT",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
  "MONETIZATION_EXPERIMENT_SALT",
  "HOUSEHOLD_SUBSCRIPTIONS_ENABLED",
  "HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT",
] as const;

const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]]),
);

const now = new Date("2099-06-07T00:00:00.000Z");

describe("SubscriptionsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    restoreManagedEnv();
    process.env.IAP_ALLOWED_PRODUCT_IDS = "expirymate_premium_monthly";
    process.env.MONETIZATION_EXPERIMENT_SALT = "subscription-test";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED = "true";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT = "100";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    restoreManagedEnv();
  });

  it("returns an empty entitlement when the user has no subscription", async () => {
    const { prisma, service } = createService();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue(null);

    const entitlement = await service.getEntitlement("owner-a");

    expect(entitlement).toEqual({
      hasActiveEntitlement: false,
      store: null,
      productId: null,
      planCode: null,
      scope: "user",
      spaceId: null,
      billingPeriod: null,
      basePlanId: null,
      status: "unknown",
      expiresAt: null,
      willRenew: null,
      environment: null,
      verifiedAt: null,
    });
  });

  it("verifies an Apple subscription and stores the entitlement", async () => {
    const privateKey = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    process.env.APPLE_APP_STORE_ENVIRONMENT = "sandbox";
    const { prisma, service } = createService();
    const expiresDate = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          environment: "Sandbox",
          bundleId: "com.expirymate.mobile",
          data: [
            {
              lastTransactions: [
                {
                  originalTransactionId: "original-transaction-1",
                  status: 1,
                  signedTransactionInfo: jws({
                    transactionId: "transaction-2",
                    originalTransactionId: "original-transaction-1",
                    productId: "expirymate_premium_monthly",
                    bundleId: "com.expirymate.mobile",
                    environment: "Sandbox",
                    expiresDate,
                  }),
                  signedRenewalInfo: jws({
                    autoRenewStatus: 1,
                    autoRenewProductId: "expirymate_premium_monthly",
                  }),
                },
              ],
            },
          ],
        }),
      ),
    );

    const response = await service.verifySubscription("owner-a", {
      store: "apple_app_store",
      transactionId: "transaction-2",
      environment: "sandbox",
    });

    expect(response.entitlement).toMatchObject({
      hasActiveEntitlement: true,
      store: "apple_app_store",
      productId: "expirymate_premium_monthly",
      status: "active",
      willRenew: true,
      environment: "Sandbox",
    });
    expect(prisma.subscriptionEntitlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKey: "owner-a",
        store: "apple_app_store",
        productId: "expirymate_premium_monthly",
        originalTransactionId: "original-transaction-1",
        transactionId: "transaction-2",
        isActive: true,
      }),
    });
  });

  it("verifies a Google Play subscription and stores only the token hash", async () => {
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }

        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "GPA.1234-5678",
          lineItems: [
            {
              productId: "expirymate_premium_monthly",
              expiryTime: "2099-07-07T00:00:00Z",
              autoRenewingPlan: {
                autoRenewEnabled: true,
              },
            },
          ],
        });
      }),
    );

    const response = await service.verifySubscription("owner-a", {
      store: "google_play",
      purchaseToken: "raw-google-token",
    });

    const createPayload =
      prisma.subscriptionEntitlement.create.mock.calls[0]?.[0].data;
    expect(response.entitlement.hasActiveEntitlement).toBe(true);
    expect(createPayload?.purchaseTokenHash).toHaveLength(64);
    expect(createPayload?.rawVerification).not.toMatchObject({
      purchaseToken: "raw-google-token",
    });
  });

  it("rejects store products that are not in the allowed product list", async () => {
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }

        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          lineItems: [
            {
              productId: "other_product",
              expiryTime: "2099-07-07T00:00:00Z",
            },
          ],
        });
      }),
    );

    await expect(
      service.verifySubscription("owner-a", {
        store: "google_play",
        purchaseToken: "raw-google-token",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("does not allow one store purchase to be attached to two owners", async () => {
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: "entitlement-1",
      ownerKey: "owner-b",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }

        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          lineItems: [
            {
              productId: "expirymate_premium_monthly",
              expiryTime: "2099-07-07T00:00:00Z",
            },
          ],
        });
      }),
    );

    await expect(
      service.verifySubscription("owner-a", {
        store: "google_play",
        purchaseToken: "token",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("rejects Google test purchases in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.APPLE_APP_STORE_ENVIRONMENT = "production";
    delete process.env.IAP_ALLOW_SANDBOX_PURCHASES;
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }

        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "GPA.test",
          testPurchase: {},
          lineItems: [
            {
              productId: "expirymate_premium_monthly",
              expiryTime: "2099-07-07T00:00:00Z",
              autoRenewingPlan: { autoRenewEnabled: true },
            },
          ],
        });
      }),
    );

    await expect(
      service.verifySubscription("owner-a", {
        store: "google_play",
        purchaseToken: "test-token",
      }),
    ).rejects.toThrow(/테스트용 결제/);
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
  });

  it("rejects Apple sandbox entitlements in production even if the client asks for sandbox", async () => {
    process.env.NODE_ENV = "production";
    process.env.APPLE_APP_STORE_ENVIRONMENT = "production";
    delete process.env.IAP_ALLOW_SANDBOX_PURCHASES;
    const privateKey = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    const expiresDate = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        environment: "Sandbox",
        bundleId: "com.expirymate.mobile",
        data: [
          {
            lastTransactions: [
              {
                originalTransactionId: "original-transaction-1",
                status: 1,
                signedTransactionInfo: jws({
                  transactionId: "transaction-2",
                  originalTransactionId: "original-transaction-1",
                  productId: "expirymate_premium_monthly",
                  bundleId: "com.expirymate.mobile",
                  environment: "Sandbox",
                  expiresDate,
                }),
                signedRenewalInfo: jws({
                  autoRenewStatus: 1,
                  autoRenewProductId: "expirymate_premium_monthly",
                }),
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      service.verifySubscription("owner-a", {
        store: "apple_app_store",
        transactionId: "transaction-2",
        environment: "sandbox",
      }),
    ).rejects.toThrow(/테스트용 결제/);

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "api.storekit.apple.com",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain(
      "storekit-sandbox",
    );
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
  });

  it("allows sandbox purchases only when explicitly opted in", async () => {
    process.env.NODE_ENV = "production";
    process.env.APPLE_APP_STORE_ENVIRONMENT = "production";
    process.env.IAP_ALLOW_SANDBOX_PURCHASES = "true";
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }

        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "GPA.test",
          testPurchase: {},
          lineItems: [
            {
              productId: "expirymate_premium_monthly",
              expiryTime: "2099-07-07T00:00:00Z",
              autoRenewingPlan: { autoRenewEnabled: true },
            },
          ],
        });
      }),
    );

    const response = await service.verifySubscription("owner-a", {
      store: "google_play",
      purchaseToken: "test-token",
    });

    expect(response.entitlement.hasActiveEntitlement).toBe(true);
    expect(prisma.subscriptionEntitlement.create).toHaveBeenCalledOnce();
  });

  it("attaches a Household purchase only to an eligible owned space", async () => {
    const privateKey = createEcPrivateKey();
    process.env.IAP_ALLOWED_PRODUCT_IDS = "expirymate_household_monthly";
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    process.env.APPLE_APP_STORE_ENVIRONMENT = "sandbox";
    const { prisma, service } = createService();
    prisma.inventorySpace.findFirst.mockResolvedValue({
      id: "space-home",
      _count: { memberships: 3 },
    });
    const expiresDate = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [{
            lastTransactions: [{
              originalTransactionId: "household-original",
              status: 1,
              signedTransactionInfo: jws({
                transactionId: "household-transaction",
                originalTransactionId: "household-original",
                productId: "expirymate_household_monthly",
                bundleId: "com.expirymate.mobile",
                environment: "Sandbox",
                expiresDate,
              }),
              signedRenewalInfo: jws({ autoRenewStatus: 1 }),
            }],
          }],
        }),
      ),
    );

    const response = await service.verifySubscription("owner-a", {
      store: "apple_app_store",
      productId: "expirymate_household_monthly",
      transactionId: "household-transaction",
      environment: "sandbox",
      spaceId: "space-home",
    });

    expect(response.entitlement).toMatchObject({
      planCode: "jango_household",
      scope: "space",
      spaceId: "space-home",
    });
    expect(prisma.subscriptionEntitlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKey: "owner-a",
        spaceId: "space-home",
        planCode: "jango_household",
      }),
    });
  });

  it("builds a 30-day plus consumption report for active subscribers", async () => {
    const prisma = {
      subscriptionEntitlement: {
        findFirst: vi.fn().mockResolvedValue({ id: "entitlement-1" }),
      },
      inventoryItem: {
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            { status: "consumed", _count: { _all: 8 } },
            { status: "discarded", _count: { _all: 2 } },
          ])
          .mockResolvedValueOnce([
            { status: "consumed", _count: { _all: 4 } },
            { status: "discarded", _count: { _all: 1 } },
          ])
          .mockResolvedValueOnce([
            { status: "consumed", _count: { _all: 3 } },
            { status: "discarded", _count: { _all: 2 } },
          ])
          .mockResolvedValueOnce([
            { category: "dairy", _count: { _all: 2 } },
          ]),
        count: vi.fn().mockResolvedValue(3),
      },
    };
    const service = new SubscriptionsService(prisma as never);

    const insights = await service.getPlusInsights(
      "owner-a",
      new Date("2026-08-10T03:00:00.000Z"),
    );

    expect(insights).toMatchObject({
      consumed: 8,
      discarded: 2,
      wasteRatePercent: 20,
      expiringSoon: 3,
      topDiscardedCategories: [{ category: "dairy", count: 2 }],
      weekly: {
        current: expect.objectContaining({
          consumed: 4,
          discarded: 1,
          wasteRatePercent: 20,
        }),
        previous: expect.objectContaining({
          consumed: 3,
          discarded: 2,
          wasteRatePercent: 40,
        }),
        wasteRateChangePercentagePoints: -20,
        trend: "improved",
      },
    });
  });
});

function createService() {
  const prisma = {
    inventorySpace: {
      findFirst: vi.fn(),
    },
    subscriptionEntitlement: {
      findFirst: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: "entitlement-1",
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      update: vi.fn().mockImplementation(async ({ data }) => ({
        id: "entitlement-1",
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
    },
  };

  return {
    prisma,
    service: new SubscriptionsService(prisma as never),
  };
}

function jsonResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

function jws(payload: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify({ alg: "ES256" }), "utf8").toString("base64url"),
    Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
    "signature",
  ].join(".");
}

function createEcPrivateKey() {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function createRsaPrivateKey() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function restoreManagedEnv() {
  for (const key of managedEnvKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
