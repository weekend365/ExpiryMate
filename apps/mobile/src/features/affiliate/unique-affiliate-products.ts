import type { AffiliateProduct } from "@expirymate/shared";

export function uniqueProductsById(products: AffiliateProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.productId)) return false;
    seen.add(product.productId);
    return true;
  });
}
