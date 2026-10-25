import { generateKeyPairSync } from "node:crypto";
import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { LoginTicket, OAuth2Client } from "google-auth-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsService } from "./subscriptions.service";
import * as unitEconomics from "../monetization/unit-economics-guardrail";
import * as appleStoreApi from "../../common/store-billing/apple-store-api";

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
  "GOOGLE_RTDN_AUDIENCE",
  "GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL",
  "MONETIZATION_EXPERIMENT_SALT",
  "MONETIZATION_OFFER_MODE",
  "SUBSCRIPTIONS_ENABLED",
  "SUBSCRIPTION_COST_GATE_MODE",
  "HOUSEHOLD_SUBSCRIPTIONS_ENABLED",
  "HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT",
  "SUBSCRIPTION_PURCHASE_INTENTS_REQUIRED",
  "SUBSCRIPTION_ACCOUNT_LINK_SECRET",
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
    process.env.MONETIZATION_OFFER_MODE = "expanded";
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.SUBSCRIPTION_COST_GATE_MODE = "required";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED = "true";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT = "100";
    process.env.SUBSCRIPTION_PURCHASE_INTENTS_REQUIRED = "false";
    process.env.SUBSCRIPTION_ACCOUNT_LINK_SECRET = "purchase-link-test-secret";
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

  it("accepts a test RTDN from the configured verified push account without purchase lookups", async () => {
    configureGooglePush();
    const verify = mockGooglePushIdentity("rtdn-push@example.iam.gserviceaccount.com");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { prisma, service } = createService();

    await expect(service.processGoogleNotification("Bearer test-token", googleNotification()))
      .resolves.toEqual({ ok: true });

    expect(verify).toHaveBeenCalledWith({
      idToken: "test-token",
      audience: "https://api.example.com/subscriptions/notifications/google",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.findUnique).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.update).not.toHaveBeenCalled();
  });

  it.each([
    { email: "other@example.iam.gserviceaccount.com", verified: true },
    { email: "rtdn-push@example.iam.gserviceaccount.com", verified: false },
  ])("rejects an unauthorized RTDN before store lookups or entitlement writes: $email/$verified", async ({ email, verified }) => {
    configureGooglePush();
    mockGooglePushIdentity(email, verified);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { prisma, service } = createService();

    await expect(service.processGoogleNotification("Bearer test-token", googleNotification("test-purchase-token")))
      .rejects.toBeInstanceOf(UnauthorizedException);

    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.findUnique).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.update).not.toHaveBeenCalled();
  });

  it("fails closed when the expected RTDN service account is not configured", async () => {
    configureGooglePush();
    delete process.env.GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL;
    const verify = mockGooglePushIdentity("rtdn-push@example.iam.gserviceaccount.com");
    const { service } = createService();

    await expect(service.processGoogleNotification("Bearer test-token", googleNotification()))
      .rejects.toThrow("Google RTDN 발신 서비스 계정이 설정되지 않았습니다.");
    expect(verify).not.toHaveBeenCalled();
  });

  it.each(["duplicate", "out-of-order"] as const)("re-fetches authoritative Play state for %s RTDN without recreating an entitlement", async (delivery) => {
    configureGooglePush();
    mockGooglePushIdentity("rtdn-push@example.iam.gserviceaccount.com");
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = "play-service@example.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = createRsaPrivateKey();
    const { prisma, service } = createService();
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: "entitlement-1", ownerKey: "owner-a", spaceId: null,
    });
    const state = delivery === "duplicate" ? "SUBSCRIPTION_STATE_ACTIVE" : "SUBSCRIPTION_STATE_EXPIRED";
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") return jsonResponse({ access_token: "test-access" });
      return jsonResponse({
        subscriptionState: state, acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        lineItems: [{
          productId: "expirymate_premium_monthly",
          expiryTime: delivery === "duplicate" ? "2099-07-07T00:00:00Z" : "2099-06-06T00:00:00Z",
          autoRenewingPlan: { autoRenewEnabled: delivery === "duplicate" },
        }],
      });
    });
    vi.stubGlobal("fetch", fetch);
    for (const index of [0, 1]) {
      const payload = Buffer.from(JSON.stringify({
        packageName: "com.expirymate.mobile",
        eventTimeMillis: delivery === "out-of-order" && index === 1 ? "100" : "200",
        subscriptionNotification: { purchaseToken: "qa-token", notificationType: index === 0 ? 13 : 2 },
      })).toString("base64");
      await expect(service.processGoogleNotification("Bearer test-token", payload)).resolves.toEqual({ ok: true });
    }
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/subscriptionsv2/tokens/"))).toHaveLength(2);
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.update).toHaveBeenCalledTimes(2);
    for (const [input] of prisma.subscriptionEntitlement.update.mock.calls) {
      expect(input.where).toEqual({ id: "entitlement-1" });
      expect(input.data.status).toBe(delivery === "duplicate" ? "active" : "expired");
      expect(input.data.ownerKey).toBe("owner-a");
    }
  });

  it.each(["duplicate", "out-of-order"] as const)("re-fetches authoritative Apple state for %s notifications", async (delivery) => {
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ENVIRONMENT = "sandbox";
    // Signature validation is covered separately; these cases isolate event ordering.
    const transaction = vi.fn()
      .mockResolvedValueOnce({ originalTransactionId: "original-1", transactionId: "current-2" })
      .mockResolvedValueOnce({ originalTransactionId: "original-1", transactionId: delivery === "duplicate" ? "current-2" : "old-1" });
    vi.spyOn(appleStoreApi, "createAppleSignedDataVerifier").mockReturnValue({
      verifyAndDecodeNotification: vi.fn().mockResolvedValue({ data: { signedTransactionInfo: "verified-transaction" } }),
      verifyAndDecodeTransaction: transaction,
    } as never);
    const { prisma, service } = createService();
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({ id: "entitlement-1", ownerKey: "owner-a", spaceId: null });
    const expiresDate = now.getTime() + (delivery === "duplicate" ? 1 : -1) * 86400_000;
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: [{ lastTransactions: [{
      originalTransactionId: "original-1", status: delivery === "duplicate" ? 1 : 2,
      signedTransactionInfo: jws({ transactionId: "current-2", originalTransactionId: "original-1",
        productId: "expirymate_premium_monthly", bundleId: "com.expirymate.mobile", environment: "Sandbox", expiresDate }),
      signedRenewalInfo: jws({ autoRenewStatus: delivery === "duplicate" ? 1 : 0 }),
    }] }] }));
    vi.stubGlobal("fetch", fetch);
    for (let deliveryIndex = 0; deliveryIndex < 2; deliveryIndex += 1) {
      await expect(service.processAppleNotification(jws({ data: { environment: "Sandbox" } }))).resolves.toEqual({ ok: true });
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.update).toHaveBeenCalledTimes(2);
    for (const [input] of prisma.subscriptionEntitlement.update.mock.calls) {
      expect(input.where).toEqual({ id: "entitlement-1" });
      expect(input.data).toMatchObject({ ownerKey: "owner-a", transactionId: "current-2", status: delivery === "duplicate" ? "active" : "expired" });
    }
  });

  it("keeps RTDN package validation after push identity verification", async () => {
    configureGooglePush();
    mockGooglePushIdentity("rtdn-push@example.iam.gserviceaccount.com");
    const { service } = createService();
    const data = Buffer.from(JSON.stringify({ packageName: "com.other.app" })).toString("base64");

    await expect(service.processGoogleNotification("Bearer test-token", data))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { mode: "required", sales: "true", allowed: false },
    { mode: "operator_override", sales: "true", allowed: true },
    { mode: "operator_override", sales: "false", allowed: false },
    { mode: "invalid", sales: "true", allowed: false },
  ])("applies the personal cost policy before creating purchase intents: $mode/$sales", async ({ mode, sales, allowed }) => {
    process.env.SUBSCRIPTION_COST_GATE_MODE = mode;
    process.env.SUBSCRIPTIONS_ENABLED = sales;
    mockUnqualifiedEconomics();
    const { prisma, service } = createService();
    prisma.subscriptionPurchaseIntent.create.mockImplementation(async ({ data }) => data);
    const pending = service.createPurchaseIntent("owner-a", {
      store: "apple_app_store", productId: "expirymate_premium_monthly",
    });
    if (allowed) {
      await expect(pending).resolves.toMatchObject({ productId: "expirymate_premium_monthly" });
      expect(prisma.subscriptionPurchaseIntent.create).toHaveBeenCalledOnce();
    } else {
      await expect(pending).rejects.toThrow(/신규 가입/);
      expect(prisma.subscriptionPurchaseIntent.create).not.toHaveBeenCalled();
    }
  });

  it("creates a short-lived personal purchase intent with store account bindings", async () => {
    const { prisma, service } = createService();
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue(null);
    prisma.subscriptionPurchaseIntent.create.mockImplementation(
      async ({ data }) => data,
    );

    const intent = await service.createPurchaseIntent(
      "owner-a",
      {
        store: "apple_app_store",
        productId: "expirymate_premium_monthly",
      },
      now,
    );

    expect(intent.appleAppAccountToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(intent.googleObfuscatedAccountId).toMatch(/^[0-9a-f]{64}$/);
    expect(intent.expiresAt).toBe(
      new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    );
    expect(prisma.subscriptionPurchaseIntent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKey: "owner-a",
        store: "apple_app_store",
        productId: "expirymate_premium_monthly",
      }),
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

  it("rejects an Apple purchase whose app account token does not match the intent", async () => {
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
    process.env.SUBSCRIPTION_PURCHASE_INTENTS_REQUIRED = "true";
    const privateKey = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    process.env.APPLE_APP_STORE_ENVIRONMENT = "sandbox";
    const { prisma, service } = createService();
    prisma.subscriptionPurchaseIntent.findUnique.mockResolvedValue({
      id: "intent-1",
      ownerKey: "owner-a",
      store: "apple_app_store",
      productId: "expirymate_premium_monthly",
      appleAppAccountToken: "expected-app-account-token",
      googleObfuscatedAccountId: "expected-google-account-id",
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
    });
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
                  originalTransactionId: "original-transaction-mismatch",
                  status: 1,
                  signedTransactionInfo: jws({
                    transactionId: "transaction-mismatch",
                    originalTransactionId: "original-transaction-mismatch",
                    productId: "expirymate_premium_monthly",
                    bundleId: "com.expirymate.mobile",
                    environment: "Sandbox",
                    appAccountToken: "different-app-account-token",
                    expiresDate: now.getTime() + 30 * 24 * 60 * 60 * 1000,
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

    await expect(
      service.verifySubscription("owner-a", {
        store: "apple_app_store",
        transactionId: "transaction-mismatch",
        purchaseIntentId: "intent-1",
        environment: "sandbox",
      }),
    ).rejects.toThrow(/로그인 계정이 일치하지 않습니다/);
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
  });

  it("recovers a missing purchaseIntentId from the signed Apple account token", async () => {
    process.env.SUBSCRIPTION_PURCHASE_INTENTS_REQUIRED = "true";
    const privateKey = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    process.env.APPLE_APP_STORE_ENVIRONMENT = "sandbox";
    const { prisma, service } = createService();
    const intent = {
      id: "intent-recovered",
      ownerKey: "owner-a",
      store: "apple_app_store",
      productId: "expirymate_premium_monthly",
      appleAppAccountToken: "recoverable-app-account-token",
      googleObfuscatedAccountId: "recoverable-google-account-id",
      expiresAt: new Date(now.getTime() - 60_000),
      consumedAt: null,
      createdAt: new Date(now.getTime() - 10 * 60_000),
    };
    prisma.subscriptionPurchaseIntent.findFirst.mockResolvedValue(intent);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          environment: "Sandbox",
          data: [
            {
              lastTransactions: [
                {
                  originalTransactionId: "original-transaction-recovered",
                  status: 1,
                  signedTransactionInfo: jws({
                    transactionId: "transaction-recovered",
                    originalTransactionId: "original-transaction-recovered",
                    productId: "expirymate_premium_monthly",
                    bundleId: "com.expirymate.mobile",
                    environment: "Sandbox",
                    appAccountToken: "recoverable-app-account-token",
                    expiresDate: now.getTime() + 30 * 24 * 60 * 60 * 1000,
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

    await expect(
      service.verifySubscription("owner-a", {
        store: "apple_app_store",
        transactionId: "transaction-recovered",
        environment: "sandbox",
      }),
    ).resolves.toMatchObject({
      entitlement: { hasActiveEntitlement: true },
    });
    expect(prisma.subscriptionPurchaseIntent.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ownerKey: "owner-a",
        appleAppAccountToken: "recoverable-app-account-token",
        consumedAt: null,
      }),
      orderBy: { createdAt: "desc" },
    });
    expect(prisma.subscriptionPurchaseIntent.update).toHaveBeenCalledWith({
      where: { id: "intent-recovered" },
      data: { consumedAt: now },
    });
  });

  it("verifies a Google Play subscription and stores only the token hash", async () => {
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
    mockUnqualifiedEconomics();
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

  it("resolves the annual Google plan from the verified purchase without a client period hint", async () => {
    process.env.IAP_ALLOWED_PRODUCT_IDS = "jango_plus";
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
    mockUnqualifiedEconomics();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = createRsaPrivateKey();
    const { prisma, service } = createService();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "google-access-token" });
      }
      return jsonResponse({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        lineItems: [{
          productId: "jango_plus",
          expiryTime: "2100-06-07T00:00:00Z",
          offerDetails: { basePlanId: "yearly" },
          autoRenewingPlan: { autoRenewEnabled: true },
        }],
      });
    }));

    const response = await service.verifySubscription("owner-a", {
      store: "google_play",
      productId: "jango_plus",
      purchaseToken: "annual-store-token",
    });

    expect(response.entitlement).toMatchObject({
      hasActiveEntitlement: true,
      billingPeriod: "yearly",
      basePlanId: "yearly",
    });
    expect(prisma.subscriptionEntitlement.create.mock.calls[0]?.[0].data)
      .toMatchObject({ billingPeriod: "yearly", basePlanId: "yearly" });
  });

  it.each([
    { name: "omitted false scalar", plan: {}, willRenew: false },
    { name: "explicit false scalar", plan: { autoRenewEnabled: false }, willRenew: false },
    { name: "absent auto-renewing plan", plan: undefined, willRenew: null },
  ])("preserves canceled access and renewal state for $name", async ({ plan, willRenew }) => {
    process.env.IAP_ALLOWED_PRODUCT_IDS = "jango_plus";
    process.env.IAP_ALLOW_SANDBOX_PURCHASES = "true";
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
    mockUnqualifiedEconomics();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = createRsaPrivateKey();
    const { prisma, service } = createService();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "google-access-token" });
      }
      return jsonResponse({
        subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        testPurchase: {},
        lineItems: [{
          productId: "jango_plus",
          expiryTime: "2100-06-07T00:00:00Z",
          offerDetails: { basePlanId: "yearly" },
          ...(plan === undefined ? {} : { autoRenewingPlan: plan }),
        }],
      });
    }));

    const response = await service.verifySubscription("owner-a", {
      store: "google_play",
      productId: "jango_plus",
      purchaseToken: "canceled-annual-store-token",
    });

    expect(response.entitlement).toMatchObject({
      hasActiveEntitlement: true,
      status: "active",
      expiresAt: "2100-06-07T00:00:00.000Z",
      willRenew,
    });
    expect(prisma.subscriptionEntitlement.create.mock.calls[0]?.[0].data)
      .toMatchObject({ isActive: true, willRenew });
  });

  it("rejects a Google purchase whose obfuscated account id does not match the intent", async () => {
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
    process.env.SUBSCRIPTION_PURCHASE_INTENTS_REQUIRED = "true";
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    prisma.subscriptionPurchaseIntent.findUnique.mockResolvedValue({
      id: "intent-google-1",
      ownerKey: "owner-a",
      store: "google_play",
      productId: "expirymate_premium_monthly",
      appleAppAccountToken: "expected-app-account-token",
      googleObfuscatedAccountId: "expected-google-account-id",
      expiresAt: new Date(now.getTime() + 60_000),
      consumedAt: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }
        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          latestOrderId: "GPA.account-mismatch",
          externalAccountIdentifiers: {
            obfuscatedExternalAccountId: "different-google-account-id",
          },
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
        productId: "expirymate_premium_monthly",
        purchaseToken: "google-account-mismatch-token",
        purchaseIntentId: "intent-google-1",
      }),
    ).rejects.toThrow(/로그인 계정이 일치하지 않습니다/);
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
  });

  it("acknowledges a Google Play subscription after granting entitlement", async () => {
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { service } = createService();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return jsonResponse({ access_token: "google-access-token" });
      }
      if (String(url).includes(":acknowledge")) {
        return jsonResponse({});
      }
      return jsonResponse({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        latestOrderId: "GPA.ack-1",
        lineItems: [
          {
            productId: "expirymate_premium_monthly",
            expiryTime: "2099-07-07T00:00:00Z",
            autoRenewingPlan: { autoRenewEnabled: true },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await service.verifySubscription("owner-a", {
      store: "google_play",
      purchaseToken: "pending-ack-token",
    });

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes(
          "/purchases/subscriptions/expirymate_premium_monthly/tokens/pending-ack-token:acknowledge",
        ),
      ),
    ).toBe(true);
  });

  it("migrates Google entitlements when Play rotates the purchase token", async () => {
    const privateKey = createRsaPrivateKey();
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    const { createHash } = await import("node:crypto");
    const oldHash = createHash("sha256").update("old-token").digest("hex");
    const newHash = createHash("sha256").update("new-token").digest("hex");
    const existing = {
      id: "entitlement-linked",
      ownerKey: "owner-a",
      spaceId: null,
      purchaseTokenHash: oldHash,
      transactionId: "GPA.old",
      willRenew: true,
    };
    prisma.subscriptionEntitlement.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, { purchaseTokenHash?: string }> }) => {
        const hash = where.store_purchaseTokenHash?.purchaseTokenHash;
        if (hash === newHash) return null;
        if (hash === oldHash) return existing;
        return null;
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "google-access-token" });
        }
        if (String(url).includes(":acknowledge")) {
          return jsonResponse({});
        }
        return jsonResponse({
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
          latestOrderId: "GPA.new",
          linkedPurchaseToken: "old-token",
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

    await service.verifySubscription("owner-a", {
      store: "google_play",
      purchaseToken: "new-token",
    });

    expect(prisma.subscriptionEntitlement.update).toHaveBeenCalledWith({
      where: { id: "entitlement-linked" },
      data: expect.objectContaining({
        purchaseTokenHash: newHash,
        transactionId: "GPA.new",
      }),
    });
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
  });

  it("falls back to Apple sandbox when production returns 4040010", async () => {
    process.env.NODE_ENV = "production";
    process.env.APPLE_APP_STORE_ENVIRONMENT = "production";
    process.env.IAP_ALLOW_SANDBOX_PURCHASES = "true";
    const privateKey = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    const { prisma, service } = createService();
    const expiresDate = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    const sandboxPayload = {
      environment: "Sandbox",
      bundleId: "com.expirymate.mobile",
      data: [
        {
          lastTransactions: [
            {
              originalTransactionId: "original-transaction-sandbox",
              status: 1,
              signedTransactionInfo: jws({
                transactionId: "transaction-sandbox",
                originalTransactionId: "original-transaction-sandbox",
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
    };
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("api.storekit.apple.com")) {
        return jsonResponse({ errorCode: 4040010 }, false, 404);
      }
      return jsonResponse(sandboxPayload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await service.verifySubscription("owner-a", {
      store: "apple_app_store",
      transactionId: "transaction-sandbox",
    });

    expect(response.entitlement.hasActiveEntitlement).toBe(true);
    expect(String(response.entitlement.environment).toLowerCase()).toBe(
      "sandbox",
    );
    expect(prisma.subscriptionEntitlement.create).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("api.storekit-sandbox.apple.com"),
      ),
    ).toBe(true);
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
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
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
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
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
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
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

  it.each([
    { mode: "required", sales: "false", allowed: false },
    { mode: "required", sales: "true", allowed: false },
    { mode: "operator_override", sales: "true", allowed: true },
    { mode: "operator_override", sales: "false", allowed: false },
  ])("applies the personal cost policy to verified new receipts: $mode/$sales", async ({ mode, sales, allowed }) => {
    process.env.SUBSCRIPTIONS_ENABLED = sales;
    process.env.SUBSCRIPTION_COST_GATE_MODE = mode;
    mockUnqualifiedEconomics();
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
          data: [
            {
              lastTransactions: [
                {
                  originalTransactionId: "original-transaction-sales-off",
                  status: 1,
                  signedTransactionInfo: jws({
                    transactionId: "transaction-sales-off",
                    originalTransactionId: "original-transaction-sales-off",
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

    const pending = service.verifySubscription("owner-a", {
        store: "apple_app_store",
        transactionId: "transaction-sales-off",
        environment: "sandbox",
      });
    if (allowed) {
      await expect(pending).resolves.toMatchObject({ entitlement: { hasActiveEntitlement: true } });
      expect(prisma.subscriptionEntitlement.create).toHaveBeenCalledOnce();
    } else {
      await expect(pending).rejects.toThrow(/신규 가입/);
      expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
    }
  });

  it("still restores an existing entitlement while subscription sales are paused", async () => {
    process.env.SUBSCRIPTIONS_ENABLED = "false";
    const privateKey = createEcPrivateKey();
    process.env.APPLE_APP_STORE_ISSUER_ID = "issuer-id";
    process.env.APPLE_APP_STORE_KEY_ID = "key-id";
    process.env.APPLE_BUNDLE_ID = "com.expirymate.mobile";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey;
    process.env.APPLE_APP_STORE_ENVIRONMENT = "sandbox";
    const { prisma, service } = createService();
    const expiresDate = now.getTime() + 30 * 24 * 60 * 60 * 1000;
    prisma.subscriptionEntitlement.findUnique.mockResolvedValue({
      id: "entitlement-existing",
      ownerKey: "owner-a",
      spaceId: null,
      originalTransactionId: "original-transaction-restore",
    });
    prisma.subscriptionEntitlement.update.mockResolvedValue({
      id: "entitlement-existing",
      ownerKey: "owner-a",
      spaceId: null,
      store: "apple_app_store",
      productId: "expirymate_premium_monthly",
      planCode: "jango_plus",
      billingPeriod: "monthly",
      basePlanId: null,
      status: "active",
      isActive: true,
      willRenew: true,
      expiresAt: new Date(expiresDate),
      environment: "Sandbox",
      verifiedAt: now,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          environment: "Sandbox",
          data: [
            {
              lastTransactions: [
                {
                  originalTransactionId: "original-transaction-restore",
                  status: 1,
                  signedTransactionInfo: jws({
                    transactionId: "transaction-restore",
                    originalTransactionId: "original-transaction-restore",
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
      transactionId: "transaction-restore",
      environment: "sandbox",
    });

    expect(response.entitlement.hasActiveEntitlement).toBe(true);
    expect(prisma.subscriptionEntitlement.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.update).toHaveBeenCalledOnce();
  });

  it("builds a 30-day plus consumption report for active subscribers", async () => {
    const prisma = {
      subscriptionEntitlement: {
        findFirst: vi.fn().mockResolvedValue({ id: "entitlement-1" }),
      },
      inventoryItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            displayName: "?곗쑀",
            expiryDate: new Date("2026-08-12T00:00:00.000Z"),
          },
          {
            displayName: "?먮몢遺",
            expiryDate: new Date("2026-08-13T00:00:00.000Z"),
          },
        ]),
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
      actions: [
        expect.objectContaining({
          kind: "use_expiring",
          priority: "high",
          count: 3,
          nearestExpiryDate: "2026-08-12",
        }),
        expect.objectContaining({
          kind: "reduce_category_waste",
          category: "dairy",
        }),
        expect.objectContaining({ kind: "keep_momentum" }),
      ],
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

function mockUnqualifiedEconomics() {
  return vi.spyOn(unitEconomics, "getUnitEconomicsAvailability").mockResolvedValue({
    subscriptions: { allowed: false, status: "learning", projectedMonthlyCostKrw: 2190,
      budgetKrw: 858, recipeSamples: 4, photoSamples: 1 },
    rewardedAds: { allowed: false, status: "blocked", coverageMultiple: 0.5 },
    paidCredits: { allowed: false, status: "blocked", coverageMultiple: 0.5 },
    subscriptionDailyLimitCaps: { subscriber: null, household: null },
  });
}

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
    subscriptionPurchaseIntent: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    prisma,
    service: new SubscriptionsService(prisma as never),
  };
}

function configureGooglePush() {
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
  process.env.GOOGLE_RTDN_AUDIENCE = "https://api.example.com/subscriptions/notifications/google";
  process.env.GOOGLE_RTDN_SERVICE_ACCOUNT_EMAIL = "rtdn-push@example.iam.gserviceaccount.com";
}

function mockGooglePushIdentity(email: string, emailVerified = true) {
  return vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockImplementation(async () => new LoginTicket("test-envelope", {
    iss: "https://accounts.google.com",
    sub: "test-push-service-account",
    aud: process.env.GOOGLE_RTDN_AUDIENCE!,
    iat: 100,
    exp: 200,
    email,
    email_verified: emailVerified,
  }));
}

function googleNotification(purchaseToken?: string) {
  return Buffer.from(JSON.stringify({
    packageName: "com.expirymate.mobile",
    ...(purchaseToken ? { subscriptionNotification: { purchaseToken } } : { testNotification: { version: "1.0" } }),
  })).toString("base64");
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
