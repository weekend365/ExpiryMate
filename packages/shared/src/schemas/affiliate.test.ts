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
    expect(parsed.presentation).toBe("none");
    expect(parsed.productGroups).toEqual([]);
  });

  it("accepts additive product groups without breaking legacy offers", () => {
    const parsed = affiliateOffersResponseSchema.parse({
      enabled: true,
      provider: "coupang_partners",
      trackingMode: "deeplink",
      presentation: "product_search",
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
      productGroups: [
        {
          ingredientName: "대파",
          reason: "향을 살릴 수 있어요",
          query: "대파",
          placement: "recipe_missing_ingredient",
          fallbackUrl: "https://link.coupang.com/a/example",
          products: [
            {
              productId: "123",
              productName: "국산 대파 1단",
              productImage: "https://thumbnail.coupangcdn.com/example.jpg",
              productUrl: "https://link.coupang.com/a/product",
              productPrice: 2980,
              isRocket: true,
              isFreeShipping: true,
              observedAt: "2026-08-18T00:00:00.000Z",
              stale: false,
            },
          ],
        },
      ],
    });

    expect(parsed.productGroups[0]?.products).toHaveLength(1);
    expect(parsed.presentation).toBe("product_search");
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
