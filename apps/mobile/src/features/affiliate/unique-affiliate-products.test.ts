import { describe, expect, it } from "vitest";
import { uniqueProductsById } from "./unique-affiliate-products";
import type { AffiliateProduct } from "@expirymate/shared";

function product(productId: string, productName: string): AffiliateProduct {
  return {
    productId,
    productName,
    productPrice: 1000,
    productImage: "https://example.com/p.jpg",
    productUrl: `https://link.coupang.com/a/${productId}`,
    isRocket: false,
    isFreeShipping: false,
    observedAt: "2026-08-18T00:00:00.000Z",
    stale: false,
  };
}

describe("uniqueProductsById", () => {
  it("keeps the first product when ids repeat", () => {
    expect(
      uniqueProductsById([
        product("1", "대파 A"),
        product("1", "대파 B"),
        product("2", "대파 C"),
      ]).map((item) => item.productId),
    ).toEqual(["1", "2"]);
  });
});
