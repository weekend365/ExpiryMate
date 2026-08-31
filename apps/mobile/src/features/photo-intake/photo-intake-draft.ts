import {
  ExpirySource,
  UnitCode,
  isDateOnlyString,
  toBaseQuantity,
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
  expiryDate: string | null;
  expirySource: ExpirySource;
  needsReview: boolean;
  reason?: string;
};

type DuplicateComparable = {
  displayName: string;
  quantity: number;
  unit?: string | null;
  storageLocation: string;
  expiryDate: string | null;
};

export type PhotoIntakeDuplicateMatch<T> =
  | { kind: "inventory"; target: T }
  | { kind: "draft"; targetLocalId: string; targetName: string };

export function photoIntakeDuplicateKey(item: DuplicateComparable) {
  const normalize = (value?: string | null) =>
    value?.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase() ?? "";
  return [
    normalize(item.displayName),
    normalize(item.unit ?? "개"),
    item.storageLocation,
    item.expiryDate ?? "unknown",
  ].join(":");
}

export function findPhotoIntakeDuplicateMatches<
  T extends DuplicateComparable & { id: string },
>(items: PhotoIntakeDraftItem[], existingItems: T[]) {
  const existingByKey = new Map<string, T>();
  for (const item of existingItems) {
    const key = photoIntakeDuplicateKey(item);
    if (!existingByKey.has(key)) existingByKey.set(key, item);
  }
  const firstDraftByKey = new Map<string, PhotoIntakeDraftItem>();
  const matches = new Map<string, PhotoIntakeDuplicateMatch<T>>();
  for (const item of items) {
    const key = photoIntakeDuplicateKey(item);
    const existing = existingByKey.get(key);
    if (existing) {
      matches.set(item.localId, { kind: "inventory", target: existing });
      continue;
    }
    const firstDraft = firstDraftByKey.get(key);
    if (firstDraft) {
      matches.set(item.localId, {
        kind: "draft",
        targetLocalId: firstDraft.localId,
        targetName: firstDraft.displayName,
      });
      continue;
    }
    firstDraftByKey.set(key, item);
  }
  return matches;
}

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
    expiryDate: candidate.suggestedExpiryDate ?? null,
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
  expiryDate: string | null,
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
  return (
    (item.expiryDate || item.expirySource === ExpirySource.UNKNOWN ? 0 : 2) +
    (item.needsReview ? 1 : 0)
  );
}

export function photoIntakeItemIsComplete(item: PhotoIntakeDraftItem) {
  return (
    item.displayName.trim().length > 0 &&
    item.storageLocation.trim().length > 0 &&
    (item.expirySource === ExpirySource.UNKNOWN ||
      (item.expiryDate !== null && isDateOnlyString(item.expiryDate)))
  );
}

export function photoIntakeItemIsReadyToSave(item: PhotoIntakeDraftItem) {
  return photoIntakeItemIsComplete(item) && !item.needsReview;
}

export function photoIntakeReadyCount(items: PhotoIntakeDraftItem[]) {
  return items.filter(photoIntakeItemIsReadyToSave).length;
}

export function canSubmitPhotoIntake(items: PhotoIntakeDraftItem[]) {
  return items.some(photoIntakeItemIsReadyToSave);
}

export function mergePhotoIntakeDraftItems(
  items: PhotoIntakeDraftItem[],
  sourceLocalId: string,
  targetLocalId: string,
) {
  const source = items.find((item) => item.localId === sourceLocalId);
  const target = items.find((item) => item.localId === targetLocalId);
  if (!source || !target || source.localId === target.localId) return items;

  return items
    .filter((item) => item.localId !== source.localId)
    .map((item) =>
      item.localId === target.localId
        ? { ...item, quantity: item.quantity + source.quantity }
        : item,
    );
}

export function draftsToCreateBody(
  items: PhotoIntakeDraftItem[],
): CreateInventoryItemBody[] {
  return items.filter(photoIntakeItemIsReadyToSave).map((item) => {
    const canonical = toBaseQuantity(item.quantity, item.unit);
    return {
      displayName: item.displayName.trim(),
      brand: item.brand,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      quantityBase: canonical.quantityBase,
      unitCode: canonical.unitCode,
      storageLocation: item.storageLocation,
      expiryDate: item.expiryDate,
      expirySource: item.expirySource,
    };
  });
}
