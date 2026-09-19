import { describe, expect, it } from "vitest";
import { uniqueProductsById } from "../index";
import type { AffiliateProduct } from "../index";

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
    const first = product("1", "대파 A");
    const second = product("2", "대파 C");
    const result = uniqueProductsById([
      first,
      second,
      product("1", "대파 B"),
      product("2", "대파 D"),
    ]);
    expect(result).toEqual([first, second]);
    expect(result[0]).toBe(first);
    expect(result[1]).toBe(second);
  });

  it("returns an empty array for no products", () => {
    expect(uniqueProductsById([])).toEqual([]);
  });

  it("preserves input order and does not mutate the array or products", () => {
    const first = Object.freeze(product("10", "대파"));
    const second = Object.freeze(product("2", "두부"));
    const products = [first, second, first];
    Object.freeze(products);

    const result = uniqueProductsById(products);
    expect(result).toEqual([first, second]);
    expect(result).not.toBe(products);
    expect(products).toEqual([first, second, first]);
  });
});
