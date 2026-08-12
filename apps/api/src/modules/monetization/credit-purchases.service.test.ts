import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CreditPurchasesService } from "./credit-purchases.service";

describe("CreditPurchasesService", () => {
  it("keeps purchase verification behind its feature flag", async () => {
    const previous = process.env.PAID_RECOMMENDATION_CREDITS_ENABLED;
    process.env.PAID_RECOMMENDATION_CREDITS_ENABLED = "false";
    const service = new CreditPurchasesService({} as never);

    await expect(
      service.verifyPurchase("owner-1", {
        store: "apple_app_store",
        productId: "credits_5",
        transactionId: "transaction-1",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    if (previous === undefined) {
      delete process.env.PAID_RECOMMENDATION_CREDITS_ENABLED;
    } else {
      process.env.PAID_RECOMMENDATION_CREDITS_ENABLED = previous;
    }
  });

  it("calculates balance from active grants and durable usage", async () => {
    const prisma = {
      recommendationCreditPurchase: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { creditsGranted: 20 } }),
      },
      recommendationUsageEvent: {
        count: vi.fn().mockResolvedValue(7),
      },
    };
    const service = new CreditPurchasesService(prisma as never);

    await expect(service.getBalance("owner-1")).resolves.toBe(13);
  });

  it("revokes a Google consumable after a validated cancellation RTDN", async () => {
    const purchase = {
      id: "purchase-1",
      ownerKey: "owner-1",
      status: "active",
    };
    const prisma = {
      recommendationCreditPurchase: {
        findUnique: vi.fn().mockResolvedValue(purchase),
        update: vi.fn().mockResolvedValue({ ...purchase, status: "revoked" }),
      },
      monetizationFunnelEvent: {
        create: vi.fn().mockResolvedValue({ id: "event-1" }),
      },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const service = new CreditPurchasesService(prisma as never);
    const data = Buffer.from(
      JSON.stringify({
        oneTimeProductNotification: {
          notificationType: 2,
          purchaseToken: "cancelled-token",
        },
      }),
      "utf8",
    ).toString("base64");

    await service.processValidatedGoogleNotification(data);

    expect(prisma.recommendationCreditPurchase.update).toHaveBeenCalledWith({
      where: { id: "purchase-1" },
      data: { status: "revoked" },
    });
    expect(prisma.monetizationFunnelEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: "credit_purchase_revoked" }),
    });
  });

  it("consumes a Google Play credit purchase after granting credits", async () => {
    const previous = process.env.PAID_RECOMMENDATION_CREDITS_ENABLED;
    const previousProducts = process.env.RECOMMENDATION_CREDIT_PRODUCTS;
    process.env.PAID_RECOMMENDATION_CREDITS_ENABLED = "true";
    process.env.RECOMMENDATION_CREDIT_PRODUCTS = "credits_5:5";
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.expirymate.mobile";
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
      "play-service@expirymate.iam.gserviceaccount.com";
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.IAP_ALLOW_SANDBOX_PURCHASES = "true";

    const prisma = {
      recommendationCreditPurchase: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "purchase-1" }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { creditsGranted: 5 } }),
      },
      recommendationUsageEvent: {
        count: vi.fn().mockResolvedValue(0),
      },
      monetizationFunnelEvent: {
        create: vi.fn().mockResolvedValue({ id: "event-1" }),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: "token" }),
        };
      }
      if (String(url).includes(":consume")) {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          purchaseState: 0,
          consumptionState: 0,
          acknowledgementState: 0,
          orderId: "GPA.credit-1",
          purchaseType: 0,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const service = new CreditPurchasesService(prisma as never);

    const result = await service.verifyPurchase("owner-1", {
      store: "google_play",
      productId: "credits_5",
      purchaseToken: "credit-token",
    });

    expect(result.creditsGranted).toBe(5);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes(
          "/purchases/products/credits_5/tokens/credit-token:consume",
        ),
      ),
    ).toBe(true);

    vi.unstubAllGlobals();
    if (previous === undefined) {
      delete process.env.PAID_RECOMMENDATION_CREDITS_ENABLED;
    } else {
      process.env.PAID_RECOMMENDATION_CREDITS_ENABLED = previous;
    }
    if (previousProducts === undefined) {
      delete process.env.RECOMMENDATION_CREDIT_PRODUCTS;
    } else {
      process.env.RECOMMENDATION_CREDIT_PRODUCTS = previousProducts;
    }
  });
});
