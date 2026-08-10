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
});
