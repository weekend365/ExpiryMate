import {
  ExpirySource,
  PHOTO_PARSE_MAX_ITEMS,
  UnitCode,
  inventoryPhotoParseCandidateSchema,
  isDateOnlyString,
  type InventoryPhotoParseCandidate,
  type InventoryPhotoParseScene,
  type InventoryPhotoParseVisionItem,
} from "@expirymate/shared";

const RECEIPT_NOISE_PATTERN =
  /(합계|총액|부가세|할인|포인트|적립|봉투|봉사료|과세|면세|받은금액|거스름|카드결제|현금|승인번호|사업자)/;

const MAX_EXPIRY_YEARS_AHEAD = 5;

export function normalizePhotoParseItems(
  scene: InventoryPhotoParseScene,
  rawItems: InventoryPhotoParseVisionItem[],
): InventoryPhotoParseCandidate[] {
  const items: InventoryPhotoParseCandidate[] = [];

  for (const raw of rawItems) {
    const displayName = raw.displayName.trim().replace(/\s+/g, " ");
    if (!displayName || RECEIPT_NOISE_PATTERN.test(displayName)) {
      continue;
    }

    const quantity = Number.isInteger(raw.quantity) && (raw.quantity ?? 0) > 0
      ? raw.quantity
      : 1;
    const suggestedExpiryDate = sanitizeSuggestedExpiry(raw.suggestedExpiryDate);
    const needsReview =
      raw.needsReview ||
      scene === "fridge" ||
      (raw.confidence ?? 0) < 0.55 ||
      !suggestedExpiryDate;

    const candidate = {
      displayName: displayName.slice(0, 120),
      brand: emptyToUndefined(raw.brand),
      category: raw.category ?? undefined,
      quantity,
      unit: emptyToUndefined(raw.unit),
      unitCode: raw.unitCode ?? UnitCode.EA,
      suggestedStorageLocation: emptyToUndefined(raw.suggestedStorageLocation),
      suggestedExpiryDate,
      expirySource: suggestedExpiryDate
        ? ExpirySource.OCR_DETECTED
        : undefined,
      confidence: clampConfidence(raw.confidence),
      needsReview,
      reason: emptyToUndefined(raw.reason)?.slice(0, 160),
    };

    const parsed = inventoryPhotoParseCandidateSchema.safeParse(candidate);
    if (parsed.success) {
      items.push(parsed.data);
    }

    if (items.length >= PHOTO_PARSE_MAX_ITEMS) {
      break;
    }
  }

  return items;
}

function sanitizeSuggestedExpiry(value: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isDateOnlyString(trimmed)) {
    return undefined;
  }

  const year = Number(trimmed.slice(0, 4));
  const nowYear = new Date().getUTCFullYear();
  if (year < nowYear - 1 || year > nowYear + MAX_EXPIRY_YEARS_AHEAD) {
    return undefined;
  }

  return trimmed;
}

function emptyToUndefined(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0.4;
  }
  return Math.min(1, Math.max(0, value));
}

export function isLikelyNonInventoryLine(name: string) {
  return RECEIPT_NOISE_PATTERN.test(name.trim());
}
