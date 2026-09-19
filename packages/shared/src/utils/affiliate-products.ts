import type { AffiliateProduct } from "../schemas/affiliate";

export function uniqueProductsById(products: AffiliateProduct[]): AffiliateProduct[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.productId)) return false;
    seen.add(product.productId);
    return true;
  });
}
