import { ProductMasterSource } from "../enums/app-enums";

export const catalogConfidenceBySource: Record<ProductMasterSource, number> = {
  [ProductMasterSource.FOODSAFETY_API]: 85,
  [ProductMasterSource.OPEN_FOOD_FACTS]: 60,
  [ProductMasterSource.USER_CONTRIBUTED]: 35,
};

export const CATALOG_NAME_CONFIRMATION_THRESHOLD = 70;
export const CATALOG_CONFIRM_CONFIDENCE_BUMP = 8;
export const catalogApplyConfidenceFloor: Record<ProductMasterSource, number> = {
  [ProductMasterSource.FOODSAFETY_API]: 75,
  [ProductMasterSource.OPEN_FOOD_FACTS]: 75,
  [ProductMasterSource.USER_CONTRIBUTED]: 70,
};

export function clampCatalogConfidence(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function initialCatalogConfidence(source?: string | null): number {
  if (source === ProductMasterSource.FOODSAFETY_API) {
    return catalogConfidenceBySource[ProductMasterSource.FOODSAFETY_API];
  }
  if (source === ProductMasterSource.OPEN_FOOD_FACTS) {
    return catalogConfidenceBySource[ProductMasterSource.OPEN_FOOD_FACTS];
  }
  return catalogConfidenceBySource[ProductMasterSource.USER_CONTRIBUTED];
}

export function resolveCatalogConfidence(
  catalog: {
    source?: string | null;
    confidence?: number | null;
  } | null,
): number {
  if (catalog && Number.isFinite(catalog.confidence)) {
    return clampCatalogConfidence(catalog.confidence as number);
  }

  return initialCatalogConfidence(catalog?.source);
}

export function catalogNeedsNameConfirmation(confidence: number): boolean {
  return confidence < CATALOG_NAME_CONFIRMATION_THRESHOLD;
}

export function bumpCatalogConfidence(
  current: number,
  amount = CATALOG_CONFIRM_CONFIDENCE_BUMP,
): number {
  return clampCatalogConfidence(current + amount);
}

export function catalogConfidenceAfterApply(
  source: string | null | undefined,
  current?: number | null,
): number {
  const floor =
    source === ProductMasterSource.USER_CONTRIBUTED
      ? catalogApplyConfidenceFloor[ProductMasterSource.USER_CONTRIBUTED]
      : catalogApplyConfidenceFloor[ProductMasterSource.FOODSAFETY_API];

  return Math.max(resolveCatalogConfidence({ source, confidence: current }), floor);
}

export function catalogConfidenceLabel(confidence: number): string {
  if (confidence >= CATALOG_NAME_CONFIRMATION_THRESHOLD) {
    return "믿을 만해요";
  }
  if (confidence >= 50) {
    return "조금 확실해요";
  }
  return "아직 덜 확실해요";
}
