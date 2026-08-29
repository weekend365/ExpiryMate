import {
  ExpirySource,
  UnitCode,
  isDateOnlyString,
  type CreateInventoryItemBody,
  type InventoryPhotoParseCandidate,
} from "@expirymate/shared";

export type PhotoIntakeDraftItem = {
  localId: string;
  displayName: string;
  brand?: string;
  category?: InventoryPhotoParseCandidate["category"];
  quantity: number;
  unit?: string;
  unitCode?: UnitCode;
  storageLocation: string;
  expiryDate: string;
  expirySource: ExpirySource;
  needsReview: boolean;
  reason?: string;
};

export function candidatesToDrafts(
  candidates: InventoryPhotoParseCandidate[],
  defaultStorageLocation: string,
): PhotoIntakeDraftItem[] {
  return candidates.map((candidate, index) => ({
    localId: `photo-${index}-${candidate.displayName}`,
    displayName: candidate.displayName,
    brand: candidate.brand,
    category: candidate.category,
    quantity: candidate.quantity ?? 1,
    unit: candidate.unit,
    unitCode: candidate.unitCode ?? UnitCode.EA,
    storageLocation: candidate.suggestedStorageLocation ?? defaultStorageLocation,
    expiryDate: candidate.suggestedExpiryDate ?? "",
    expirySource: candidate.expirySource ?? ExpirySource.MANUAL,
    needsReview: candidate.needsReview,
    reason: candidate.reason,
  }));
}

export function applyStorageLocationToAll(
  items: PhotoIntakeDraftItem[],
  storageLocation: string,
): PhotoIntakeDraftItem[] {
  return items.map((item) => ({ ...item, storageLocation }));
}

export function applyExpiryToAll(
  items: PhotoIntakeDraftItem[],
  expiryDate: string,
  expirySource: ExpirySource,
): PhotoIntakeDraftItem[] {
  return items.map((item) => ({ ...item, expiryDate, expirySource }));
}

export function prioritizePhotoIntakeDrafts(
  items: PhotoIntakeDraftItem[],
): PhotoIntakeDraftItem[] {
  return [...items].sort(
    (left, right) => attentionScore(right) - attentionScore(left),
  );
}

function attentionScore(item: PhotoIntakeDraftItem) {
  return (item.expiryDate ? 0 : 2) + (item.needsReview ? 1 : 0);
}

export function photoIntakeItemIsComplete(item: PhotoIntakeDraftItem) {
  return (
    item.displayName.trim().length > 0 &&
    item.storageLocation.trim().length > 0 &&
    isDateOnlyString(item.expiryDate)
  );
}

export function photoIntakeReadyCount(items: PhotoIntakeDraftItem[]) {
  return items.filter(photoIntakeItemIsComplete).length;
}

export function canSubmitPhotoIntake(items: PhotoIntakeDraftItem[]) {
  return items.length > 0 && items.every(photoIntakeItemIsComplete);
}

export function draftsToCreateBody(
  items: PhotoIntakeDraftItem[],
): CreateInventoryItemBody[] {
  return items.filter(photoIntakeItemIsComplete).map((item) => ({
    displayName: item.displayName.trim(),
    brand: item.brand,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    unitCode: item.unitCode,
    storageLocation: item.storageLocation,
    expiryDate: item.expiryDate,
    expirySource: item.expirySource,
  }));
}
