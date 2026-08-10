export type RecommendationCreditProduct = {
  productId: string;
  credits: number;
};

export function paidRecommendationCreditsEnabled() {
  return process.env.PAID_RECOMMENDATION_CREDITS_ENABLED
    ?.trim()
    .toLowerCase() === "true";
}

export function getRecommendationCreditProducts(): RecommendationCreditProduct[] {
  const seen = new Set<string>();

  return (process.env.RECOMMENDATION_CREDIT_PRODUCTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separator = entry.lastIndexOf(":");
      if (separator <= 0) return [];
      const productId = entry.slice(0, separator).trim();
      const credits = Number(entry.slice(separator + 1));
      if (!productId || seen.has(productId) || !Number.isInteger(credits) || credits <= 0) {
        return [];
      }
      seen.add(productId);
      return [{ productId, credits }];
    });
}
