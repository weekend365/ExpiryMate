export type CatalogIdentity = {
  name: string;
  brand?: string | null;
  category?: string | null;
};

export function normalizeCatalogText(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function hasProvidedCatalogField(value?: string | null): value is string {
  return Boolean(value && value.trim());
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
