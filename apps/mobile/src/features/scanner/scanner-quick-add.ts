import {
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  type CreateInventoryItemBody,
  toBaseQuantity,
} from "@expirymate/shared";
import type { ProductLookupStatus } from "./useProductScanner";

export function canQuickAddScannedProduct({
  productLookupStatus,
  productName,
  needsNameConfirmation,
  expirationDate,
}: {
  productLookupStatus: ProductLookupStatus;
  productName?: string | null;
  needsNameConfirmation: boolean;
  expirationDate?: string | null;
}) {
  return Boolean(
    productLookupStatus === "success" &&
      productName?.trim() &&
      !needsNameConfirmation &&
      expirationDate?.trim(),
  );
}

export function resolveScannerQuickStorageLocation({
  draftStorageLocation,
  lastStorageLocation,
  availableLocationKeys = [],
}: {
  draftStorageLocation?: string | null;
  lastStorageLocation?: string | null;
  availableLocationKeys?: string[];
}) {
  const recentLocations = [draftStorageLocation, lastStorageLocation]
    .map((location) => location?.trim())
    .filter((location): location is string => Boolean(location));
  const recentLocation = recentLocations.find(
    (location) =>
      availableLocationKeys.length === 0 ||
      availableLocationKeys.includes(location),
  );

  if (recentLocation) {
    return recentLocation;
  }

  return (
    availableLocationKeys[0] ?? DEFAULT_INVENTORY_FORM.storageLocation
  );
}

export function buildScannerQuickAddPayload({
  productMasterId,
  displayName,
  brand,
  quantity,
  storageLocation,
  expiryDate,
}: {
  productMasterId?: string | null;
  displayName: string;
  brand?: string | null;
  quantity: number;
  storageLocation: string;
  expiryDate: string;
}): CreateInventoryItemBody {
  const unit = DEFAULT_INVENTORY_FORM.unit;
  const canonical = toBaseQuantity(quantity, unit);

  return {
    productMasterId: productMasterId?.trim() || undefined,
    displayName: displayName.trim(),
    brand: brand?.trim() || undefined,
    quantity,
    unit,
    quantityBase: canonical.quantityBase,
    unitCode: canonical.unitCode,
    storageLocation,
    expiryDate,
    expirySource: ExpirySource.OCR_DETECTED,
  };
}
