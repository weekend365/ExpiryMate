import { generateKeyPairSync } from "node:crypto";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsService } from "./subscriptions.service";

const managedEnvKeys = [
  "IAP_ALLOWED_PRODUCT_IDS",
  "APPLE_APP_STORE_ISSUER_ID",
  "APPLE_APP_STORE_KEY_ID",
  "APPLE_BUNDLE_ID",
  "APPLE_APP_STORE_PRIVATE_KEY",
  "APPLE_APP_STORE_ENVIRONMENT",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
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
});

function createService() {
  const prisma = {
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
