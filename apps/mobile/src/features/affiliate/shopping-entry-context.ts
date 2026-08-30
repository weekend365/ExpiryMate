import type { AffiliateContextualSearchPlacement } from "@expirymate/shared";

const SOURCE_TO_PLACEMENT: Record<string, AffiliateContextualSearchPlacement> = {
  inventory_consumed: "inventory_consumed",
  cooking_complete: "cooking_complete",
  recipe_optional_entry: "recipe_optional_entry",
  home_reorder_preview: "home_reorder_preview",
};

export function parseShoppingEntryContext(input: {
  q?: string | string[];
  items?: string | string[];
  source?: string | string[];
}) {
  const source = firstValue(input.source)?.trim() || "shopping_navigation";
  const itemQueries = parseItems(firstValue(input.items));
  const directQuery = firstValue(input.q)?.trim();
  const queries = uniqueQueries([
    ...itemQueries,
    ...(directQuery ? [directQuery] : []),
  ]).slice(0, 3);
  return {
    source,
    queries,
    placement: SOURCE_TO_PLACEMENT[source] ?? "shopping_search",
  };
}

function parseItems(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function uniqueQueries(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase("ko-KR");
    if (!trimmed || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
