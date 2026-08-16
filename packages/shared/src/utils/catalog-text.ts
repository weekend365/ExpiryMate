import { ProductMasterSource } from "../enums/app-enums";

export type CatalogIdentity = {
  name: string;
  brand?: string | null;
  category?: string | null;
};

export const catalogCorrectionThresholds: Record<ProductMasterSource, number> = {
  [ProductMasterSource.USER_CONTRIBUTED]: 2,
  [ProductMasterSource.FOODSAFETY_API]: 3,
  [ProductMasterSource.OPEN_FOOD_FACTS]: 3,
};

export function catalogCorrectionThresholdFor(
  source: string | null | undefined,
): number {
  if (source === ProductMasterSource.USER_CONTRIBUTED) {
    return catalogCorrectionThresholds[ProductMasterSource.USER_CONTRIBUTED];
  }

  return catalogCorrectionThresholds[ProductMasterSource.FOODSAFETY_API];
}

export function normalizeCatalogText(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function catalogCorrectionVoteKey(name: string): string {
  return normalizeCatalogText(name);
}

function hasProvidedCatalogField(value?: string | null): value is string {
  return Boolean(value && value.trim());
}

export function resolveCatalogDisplayIdentity(catalog: {
  name: string;
  brand: string;
  category: string;
  crowdName?: string | null;
  crowdBrand?: string | null;
  crowdCategory?: string | null;
}): CatalogIdentity {
  return {
    name: catalog.crowdName?.trim() || catalog.name,
    brand: catalog.crowdBrand?.trim() || catalog.brand,
    category: catalog.crowdCategory?.trim() || catalog.category,
  };
}

/** True when the proposed identity is a meaningful change from the catalog. */
export function catalogIdentityDiffers(
  catalog: CatalogIdentity,
  proposed: CatalogIdentity,
): boolean {
  if (normalizeCatalogText(catalog.name) !== normalizeCatalogText(proposed.name)) {
    return true;
  }

  if (
    hasProvidedCatalogField(proposed.brand) &&
    normalizeCatalogText(catalog.brand) !== normalizeCatalogText(proposed.brand)
  ) {
    return true;
  }

  if (
    hasProvidedCatalogField(proposed.category) &&
    normalizeCatalogText(catalog.category) !==
      normalizeCatalogText(proposed.category)
  ) {
    return true;
  }

  return false;
}

export function pickMostCommonCatalogText(
  values: Array<string | null | undefined>,
): string | null {
  const counts = new Map<string, { count: number; original: string }>();

  for (const value of values) {
    if (!hasProvidedCatalogField(value)) {
      continue;
    }
    const key = normalizeCatalogText(value);
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { count: 1, original: value.trim() });
    }
  }

  let winner: { count: number; original: string } | null = null;
  for (const entry of counts.values()) {
    if (!winner || entry.count > winner.count) {
      winner = entry;
    }
  }

  return winner?.original ?? null;
}
