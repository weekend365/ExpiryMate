import { unitCodeLabels } from "../constants/labels";
import { UnitCode } from "../enums/app-enums";
import type { InventoryItem } from "../types/models";

export const formatBaseQuantity = (
  quantityBase: number,
  unitCode: UnitCode,
): string => {
  if (unitCode === UnitCode.ML && quantityBase >= 1000) {
    const liters = quantityBase / 1000;
    return `${liters}L`;
  }

  if (unitCode === UnitCode.G && quantityBase >= 1000) {
    const kilograms = quantityBase / 1000;
    return `${kilograms}kg`;
  }

  if (unitCode === UnitCode.EA) {
    return `${quantityBase}개`;
  }

  return `${quantityBase}${unitCode}`;
};

export const inferUnitCode = (unit: string | null | undefined): UnitCode => {
  const normalized = unit?.trim().toLowerCase();

  if (normalized === "ml" || normalized === "밀리리터") {
    return UnitCode.ML;
  }

  if (
    normalized === "l" ||
    normalized === "리터" ||
    normalized === "g" ||
    normalized === "그램" ||
    normalized === "kg" ||
    normalized === "킬로그램"
  ) {
    return normalized === "l" || normalized === "리터"
      ? UnitCode.ML
      : UnitCode.G;
  }

  return UnitCode.EA;
};

export const toBaseQuantity = (
  quantity: number,
  unit: string | null | undefined,
): { quantityBase: number; unitCode: UnitCode } => {
  const unitCode = inferUnitCode(unit);
  const normalized = unit?.trim().toLowerCase();
  const scale =
    normalized === "l" ||
    normalized === "리터" ||
    normalized === "kg" ||
    normalized === "킬로그램"
      ? 1000
      : 1;

  return {
    quantityBase: Math.max(1, Math.round(quantity * scale)),
    unitCode,
  };
};

export const usesCanonicalQuantity = (
  item: Pick<InventoryItem, "quantity" | "quantityBase" | "unitCode">,
) => item.unitCode !== UnitCode.EA || item.quantityBase !== item.quantity;

export const isMeasureUnitCode = (unitCode: UnitCode) =>
  unitCode === UnitCode.ML || unitCode === UnitCode.G;

/**
 * Prefer editing the live stock amount for measure / pack-content rows.
 * Packaging-only labels (팩/판) stay in `unit` only when count identity holds.
 */
export const inventoryItemToFormValues = (
  item: Pick<
    InventoryItem,
    | "productId"
    | "displayName"
    | "brand"
    | "category"
    | "quantity"
    | "unit"
    | "quantityBase"
    | "unitCode"
    | "storageLocation"
    | "expiryDate"
    | "expirySource"
    | "notes"
  >,
) => {
  const canonical = usesCanonicalQuantity(item);
  const editableQuantity = Math.max(
    1,
    canonical ? item.quantityBase : item.quantity,
  );

  return {
    productId: item.productId ?? undefined,
    displayName: item.displayName,
    brand: item.brand ?? undefined,
    category: item.category ?? undefined,
    quantity: editableQuantity,
    unit: canonical ? unitCodeLabels[item.unitCode] : (item.unit ?? "개"),
    quantityBase: editableQuantity,
    unitCode: item.unitCode,
    storageLocation: item.storageLocation,
    expiryDate: item.expiryDate,
    expirySource: item.expirySource,
    notes: item.notes ?? undefined,
  };
};

/**
 * Decide how an inventory write should update canonical stock.
 * Returns null when quantityBase/unitCode should stay unchanged.
 */
export const resolveCanonicalQuantityUpdate = (params: {
  current: Pick<
    InventoryItem,
    "quantity" | "unit" | "quantityBase" | "unitCode"
  >;
  quantity?: number;
  unit?: string | null;
  quantityBase?: number;
  unitCode?: UnitCode;
}): { quantityBase: number; unitCode: UnitCode } | null => {
  const nextQuantity = params.quantity ?? params.current.quantity;
  const nextUnit = params.unit ?? params.current.unit;
  const quantityChanged =
    params.quantity !== undefined &&
    params.quantity !== params.current.quantity;
  const unitChanged =
    params.unit !== undefined && params.unit !== params.current.unit;
  const hasExplicitCanonical =
    params.quantityBase !== undefined || params.unitCode !== undefined;

  if (!hasExplicitCanonical && !quantityChanged && !unitChanged) {
    return null;
  }

  const derived = toBaseQuantity(nextQuantity, nextUnit);
  const quantityBase = params.quantityBase ?? derived.quantityBase;
  const unitCode = params.unitCode ?? derived.unitCode;

  // Keep ml/g remaining stock when the free-text unit is still a packaging label.
  if (
    !hasExplicitCanonical &&
    isMeasureUnitCode(params.current.unitCode) &&
    !isMeasureUnitCode(derived.unitCode)
  ) {
    return null;
  }

  return { quantityBase, unitCode };
};

export const formatInventoryQuantity = (
  item: Pick<
    InventoryItem,
    "quantity" | "unit" | "quantityBase" | "unitCode"
  >,
): string => {
  return usesCanonicalQuantity(item)
    ? formatBaseQuantity(item.quantityBase, item.unitCode)
    : `${item.quantity}${item.unit ?? "개"}`;
};
