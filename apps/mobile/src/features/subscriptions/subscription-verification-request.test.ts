import { describe, expect, it } from "vitest";
import { buildSubscriptionVerificationRequest } from "./subscription-verification-request";

describe("subscription verification request", () => {
  it.each(["monthly", "yearly", null, undefined])(
    "leaves Android period verification to the server despite SDK plan %s",
    (currentPlanId) => {
      const request = buildSubscriptionVerificationRequest(
        "google_play",
        { productId: "jango_plus", purchaseToken: "store-token", currentPlanId },
        "purchase-intent",
      );

      expect(request).not.toHaveProperty("basePlanId");
      expect(request).toMatchObject({
        store: "google_play",
        productId: "jango_plus",
        purchaseToken: "store-token",
        purchaseIntentId: "purchase-intent",
      });
    },
  );

  it("restores an Android purchase without inventing a period or new intent", () => {
    const request = buildSubscriptionVerificationRequest("google_play", {
      productId: "jango_plus",
      purchaseToken: "restored-token",
      currentPlanId: "monthly",
    });

    expect(request).not.toHaveProperty("basePlanId");
    expect(request.purchaseIntentId).toBeUndefined();
    expect(request.purchaseToken).toBe("restored-token");
  });

  it("preserves Apple signed transaction and purchase-intent bindings", () => {
    expect(buildSubscriptionVerificationRequest(
      "apple_app_store",
      { productId: "expirymate_premium_yearly", transactionId: "apple-transaction" },
      "apple-intent",
    )).toEqual({
      store: "apple_app_store",
      productId: "expirymate_premium_yearly",
      transactionId: "apple-transaction",
      purchaseIntentId: "apple-intent",
    });
  });
});
