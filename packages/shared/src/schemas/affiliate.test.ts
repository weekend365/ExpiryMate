import { describe, expect, it } from "vitest";
import {
  COUPANG_PARTNERS_DISCLOSURE,
  affiliateOffersResponseSchema,
} from "./affiliate";

describe("affiliate offer contract", () => {
  it("accepts a Phase A partner-link offer payload", () => {
    const parsed = affiliateOffersResponseSchema.parse({
      enabled: true,
      provider: "coupang_partners",
      trackingMode: "partner_link",
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      offers: [
        {
          ingredientName: "대파",
          reason: "향을 살릴 수 있어요",
          query: "대파",
          landingUrl: "https://link.coupang.com/a/example",
          tracked: true,
        },
      ],
    });

    expect(parsed.offers).toHaveLength(1);
    expect(parsed.offers[0]?.tracked).toBe(true);
  });

  it("rejects more than two offers in Phase A", () => {
    const offer = {
      ingredientName: "대파",
      reason: "향을 살릴 수 있어요",
      query: "대파",
      landingUrl: "https://www.coupang.com/np/search?q=green-onion",
      tracked: false,
    };

    expect(
      affiliateOffersResponseSchema.safeParse({
        enabled: true,
        provider: "coupang_partners",
        trackingMode: "partner_link",
        disclosure: COUPANG_PARTNERS_DISCLOSURE,
        offers: [offer, offer, offer],
      }).success,
    ).toBe(false);
  });
});
