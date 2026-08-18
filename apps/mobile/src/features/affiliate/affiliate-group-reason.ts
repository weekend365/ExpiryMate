const GENERIC_INGREDIENT_REASONS = new Set([
  "최근에 모두 사용한 재료예요.",
  "최근에 모두 사용한 재료예요",
  "직접 검색한 상품이에요.",
  "직접 검색한 상품이에요",
]);

/** Keep copy that explains this ingredient; drop repeated section boilerplate. */
export function visibleIngredientReason(reason: string | undefined) {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed || GENERIC_INGREDIENT_REASONS.has(trimmed)) {
    return null;
  }
  return trimmed;
}
