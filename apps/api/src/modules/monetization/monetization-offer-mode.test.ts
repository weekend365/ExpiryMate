import { afterEach, describe, expect, it } from "vitest";
import {
  expandedMonetizationOffersEnabled,
  getMonetizationOfferMode,
} from "./monetization-offer-mode";
import {
  paidRecommendationCreditsEnabled,
  paidRecommendationCreditSalesEnabled,
} from "./paid-credit-policy";

afterEach(() => {
  delete process.env.MONETIZATION_OFFER_MODE;
  delete process.env.PAID_RECOMMENDATION_CREDITS_ENABLED;
});

describe("monetization offer mode", () => {
  it("keeps expanded behavior as the local-development fallback", () => {
    expect(getMonetizationOfferMode()).toBe("expanded");
    expect(expandedMonetizationOffersEnabled()).toBe(true);
  });

  it("stops new credit sales in core mode without disabling receipt fulfillment", () => {
    process.env.MONETIZATION_OFFER_MODE = "core";
    process.env.PAID_RECOMMENDATION_CREDITS_ENABLED = "true";

    expect(paidRecommendationCreditsEnabled()).toBe(true);
    expect(paidRecommendationCreditSalesEnabled()).toBe(false);
  });
});
