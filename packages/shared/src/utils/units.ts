import { unitCodeLabels } from "../constants/labels";
import { ProductCategory, UnitCode } from "../enums/app-enums";
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
    | "productMasterId"
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
    productMasterId: item.productMasterId ?? undefined,
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

export const canPartiallyConsumeInventoryItem = (
  item: Pick<InventoryItem, "quantityBase">,
) => item.quantityBase > 1;

export const defaultPartialConsumeAmount = (
  item: Pick<InventoryItem, "quantityBase" | "unitCode">,
) => {
  const remaining = Math.max(1, Math.floor(item.quantityBase));
  const suggested = defaultQuantityForInputUnit(unitCodeLabels[item.unitCode]);

  if (suggested < remaining) {
    return suggested;
  }

  return Math.max(1, Math.floor(remaining / 2));
};

/**
 * Optimistic leftover after consuming `amountBase`.
 * Mirrors API `batchConsume` count-sync for individual EA lots.
 */
export const applyConsumedAmountToInventoryItem = <
  T extends Pick<InventoryItem, "quantity" | "quantityBase" | "unitCode">,
>(
  item: T,
  amountBase: number,
): T => {
  const consumed = Math.min(
    Math.max(0, Math.floor(amountBase)),
    item.quantityBase,
  );
  const nextQuantityBase = item.quantityBase - consumed;
  const syncCountQuantity =
    item.unitCode === UnitCode.EA &&
    item.quantity === item.quantityBase &&
    nextQuantityBase > 0;

  return {
    ...item,
    quantityBase: nextQuantityBase,
    quantity: syncCountQuantity ? nextQuantityBase : item.quantity,
  };
};

export const QUANTITY_INPUT_UNITS = [
  { label: "개", unit: "개" },
  { label: "ml", unit: "ml" },
  { label: "L", unit: "L" },
  { label: "g", unit: "g" },
  { label: "kg", unit: "kg" },
] as const;

export type QuantityInputUnit = (typeof QUANTITY_INPUT_UNITS)[number]["unit"];

export function resolveQuantityInputUnit(
  unit?: string | null,
): QuantityInputUnit {
  const normalized = unit?.trim() ?? "개";
  const exact = QUANTITY_INPUT_UNITS.find(
    (option) => option.unit.toLowerCase() === normalized.toLowerCase(),
  );
  if (exact) {
    return exact.unit;
  }

  const unitCode = inferUnitCode(normalized);
  if (unitCode === UnitCode.ML) {
    return "ml";
  }
  if (unitCode === UnitCode.G) {
    return "g";
  }
  return "개";
}

export function quantityInputLabel(
  unit?: string | null,
  options?: { remaining?: boolean },
) {
  const remaining = Boolean(options?.remaining);
  if (resolveQuantityInputUnit(unit) === "개") {
    return remaining ? "몇 개 남았나요?" : "몇 개인가요?";
  }
  return remaining ? "얼마나 남았나요?" : "얼마나 있어요?";
}

export function quantityInputStep(unit?: string | null) {
  const resolved = resolveQuantityInputUnit(unit);
  return resolved === "ml" || resolved === "g" ? 50 : 1;
}

export function defaultQuantityForInputUnit(unit?: string | null) {
  const resolved = resolveQuantityInputUnit(unit);
  if (resolved === "ml") {
    return 200;
  }
  if (resolved === "g") {
    return 100;
  }
  return 1;
}

export function suggestQuantityInputUnit(
  displayName?: string | null,
  category?: ProductCategory | null,
): QuantityInputUnit {
  if (
    category === ProductCategory.DAIRY ||
    category === ProductCategory.BEVERAGE
  ) {
    return "ml";
  }

  const name = displayName?.trim() ?? "";
  if (/우유|두유|주스|식초|소스|국물/.test(name)) {
    return "ml";
  }
  if (/소고기|돼지고기|닭고기|닭가슴|다진고기|분말/.test(name)) {
    return "g";
  }
  return "개";
}

export function convertQuantityForInputUnit(
  quantity: number,
  fromUnit?: string | null,
  toUnit?: string | null,
): number {
  const from = resolveQuantityInputUnit(fromUnit);
  const to = resolveQuantityInputUnit(toUnit);
  const safeQuantity =
    Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : 1;

  if (from === to) {
    return Math.max(1, safeQuantity);
  }

  const fromBase = toBaseQuantity(safeQuantity, from);
  const toCode = inferUnitCode(to);

  if (fromBase.unitCode === toCode) {
    if (to === "L" || to === "kg") {
      const scaled = fromBase.quantityBase / 1000;
      if (scaled >= 1) {
        return Math.max(1, Math.round(scaled));
      }
      return defaultQuantityForInputUnit(to);
    }

    return Math.max(1, fromBase.quantityBase);
  }

  return defaultQuantityForInputUnit(to);
}

export function quantityValuesForInputUnit(params: {
  quantity: number;
  fromUnit?: string | null;
  toUnit: string;
}) {
  const quantity = convertQuantityForInputUnit(
    params.quantity,
    params.fromUnit,
    params.toUnit,
  );
  const canonical = toBaseQuantity(quantity, params.toUnit);

  return {
    quantity,
    unit: params.toUnit,
    quantityBase: canonical.quantityBase,
    unitCode: canonical.unitCode,
  };
}

export function formatEnteredQuantity(
  quantity: number,
  unit?: string | null,
): string {
  const canonical = toBaseQuantity(quantity, unit);
  return formatBaseQuantity(canonical.quantityBase, canonical.unitCode);
}
