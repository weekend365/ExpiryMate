import {
  ExpirySource,
  UnitCode,
  isDateOnlyString,
  inferUnitCode,
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
  brand?: string | null;
  unitCode?: UnitCode;
  unit?: string | null;
  storageLocation: string;
  expiryDate: string | null;
};

export type PhotoIntakeDuplicateMatch<T> = (
  | { kind: "inventory"; target: T }
  | { kind: "draft"; targetLocalId: string; targetName: string }
) & { strength: "exact" | "possible" };

const normalize = (value?: string | null) =>
  value?.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase() ?? "";

function displayUnit(item: Pick<DuplicateComparable, "unit" | "unitCode">) {
  return item.unit?.trim() ||
    (item.unitCode === UnitCode.ML ? "ml" : item.unitCode === UnitCode.G ? "g" : "개");
}

function normalizedBrand(brand?: string | null) {
  const value = normalize(brand);
  return ["미상", "불명", "알수없음", "없음", "브랜드미상", "브랜드불명", "브랜드없음", "unknown"].includes(value)
    ? ""
    : value;
}

export function photoIntakeDuplicateKey(item: DuplicateComparable) {
  return JSON.stringify([
    normalize(item.displayName),
    normalize(displayUnit(item)),
    item.unitCode ?? inferUnitCode(displayUnit(item)),
    item.storageLocation,
    item.expiryDate ?? "unknown",
  ]);
}

function matchStrength(left: DuplicateComparable, right: DuplicateComparable) {
  if (photoIntakeDuplicateKey(left) !== photoIntakeDuplicateKey(right)) return undefined;
  const a = normalizedBrand(left.brand);
  const b = normalizedBrand(right.brand);
  if (a && b) return a === b ? "exact" as const : undefined;
  return "possible" as const;
}

export function findPhotoIntakeDuplicateMatches<
  T extends DuplicateComparable & { id: string },
>(items: PhotoIntakeDraftItem[], existingItems: T[]) {
  const matches = new Map<string, PhotoIntakeDuplicateMatch<T>>();
  const preceding: PhotoIntakeDraftItem[] = [];
  for (const item of items) {
    const options: PhotoIntakeDuplicateMatch<T>[] = [];
    for (const target of existingItems) {
      const strength = matchStrength(item, target);
      if (strength) options.push({ kind: "inventory", target, strength });
    }
    for (const target of preceding) {
      const strength = matchStrength(item, target);
      if (strength) options.push({
        kind: "draft",
        targetLocalId: target.localId,
        targetName: target.displayName,
        strength,
      });
    }
    const match = options.find((option) => option.strength === "exact") ?? options[0];
    if (match) matches.set(item.localId, match);
    preceding.push(item);
  }
  return matches;
}

/** Raw quantities may only be added with the same display AND canonical units. */
export function photoIntakeCanMerge(
  source: PhotoIntakeDraftItem,
  target: DuplicateComparable,
) {
  return (
    photoIntakeItemIsReadyToSave(source) &&
    matchStrength(source, target) === "exact" &&
    toBaseQuantity(source.quantity, displayUnit(source)).unitCode === (source.unitCode ?? inferUnitCode(displayUnit(source))) &&
    toBaseQuantity(target.quantity, displayUnit(target)).unitCode === (target.unitCode ?? inferUnitCode(displayUnit(target)))
  );
}

export function photoIntakeDuplicateMessage(match: PhotoIntakeDuplicateMatch<unknown>) {
  if (match.strength === "possible") {
    return match.kind === "inventory"
      ? "보관함에 비슷한 항목이 있어요. 브랜드가 불명확해 참고만 해 주세요."
      : "사진 결과에 비슷한 항목이 있어요. 브랜드가 불명확해 참고만 해 주세요.";
  }
  return match.kind === "inventory"
    ? "보관함에 같은 정보의 항목이 있어요"
    : "사진 결과에 같은 항목이 반복됐어요";
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
    unit: displayUnit(candidate),
    unitCode: candidate.unitCode ?? inferUnitCode(candidate.unit),
    storageLocation: candidate.suggestedStorageLocation ?? defaultStorageLocation,
    expiryDate: candidate.suggestedExpiryDate ?? null,
    expirySource: candidate.expirySource ?? ExpirySource.MANUAL,
    needsReview: candidate.needsReview,
    reason: candidate.reason,
  }));
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
  if (
    !source || !target || source.localId === target.localId ||
    !photoIntakeItemIsReadyToSave(target) || !photoIntakeCanMerge(source, target)
  ) return items;

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
