import { describe, expect, it } from "vitest";
import { ExpirySource, ProductCategory, UnitCode } from "../enums/app-enums";
import {
  applyConsumedAmountToInventoryItem,
  canPartiallyConsumeInventoryItem,
  convertQuantityForInputUnit,
  defaultPartialConsumeAmount,
  defaultQuantityForInputUnit,
  formatBaseQuantity,
  formatEnteredQuantity,
  formatInventoryQuantity,
  inferUnitCode,
  inventoryItemToFormValues,
  quantityInputStep,
  quantityValuesForInputUnit,
  quantityInputLabel,
  resolveCanonicalQuantityUpdate,
  resolveQuantityInputUnit,
  suggestQuantityInputUnit,
  toBaseQuantity,
} from "./units";

describe("canonical inventory quantities", () => {
  it("stores liters and kilograms in integer base units", () => {
    expect(toBaseQuantity(1, "L")).toEqual({
      quantityBase: 1000,
      unitCode: UnitCode.ML,
    });
    expect(toBaseQuantity(0.5, "kg")).toEqual({
      quantityBase: 500,
      unitCode: UnitCode.G,
    });
  });

  it("keeps packaging labels as count units", () => {
    expect(inferUnitCode("팩")).toBe(UnitCode.EA);
    expect(toBaseQuantity(2, "팩")).toEqual({
      quantityBase: 2,
      unitCode: UnitCode.EA,
    });
  });

  it("formats canonical units for people", () => {
    expect(formatBaseQuantity(500, UnitCode.ML)).toBe("500ml");
    expect(formatBaseQuantity(1500, UnitCode.ML)).toBe("1.5L");
    expect(formatBaseQuantity(2, UnitCode.EA)).toBe("2개");
    expect(
      formatInventoryQuantity({
        quantity: 1,
        unit: "팩",
        quantityBase: 500,
        unitCode: UnitCode.ML,
      }),
    ).toBe("500ml");
  });

  it("edits remaining measure stock instead of packaging count", () => {
    expect(
      inventoryItemToFormValues({
        productId: null,
        displayName: "서울우유 1L",
        brand: "서울우유",
        category: null,
        quantity: 1,
        unit: "팩",
        quantityBase: 500,
        unitCode: UnitCode.ML,
        storageLocation: "fridge",
        expiryDate: "2026-07-24",
        expirySource: ExpirySource.MANUAL,
        notes: null,
      }),
    ).toMatchObject({
      quantity: 500,
      unit: "ml",
      quantityBase: 500,
      unitCode: UnitCode.ML,
    });
  });

  it("preserves ml stock when packaging quantity is edited without measure units", () => {
    expect(
      resolveCanonicalQuantityUpdate({
        current: {
          quantity: 1,
          unit: "팩",
          quantityBase: 500,
          unitCode: UnitCode.ML,
        },
        quantity: 2,
        unit: "팩",
      }),
    ).toBeNull();
  });

  it("accepts explicit canonical writes after cooking", () => {
    expect(
      resolveCanonicalQuantityUpdate({
        current: {
          quantity: 1,
          unit: "팩",
          quantityBase: 500,
          unitCode: UnitCode.ML,
        },
        quantity: 300,
        unit: "ml",
        quantityBase: 300,
        unitCode: UnitCode.ML,
      }),
    ).toEqual({
      quantityBase: 300,
      unitCode: UnitCode.ML,
    });
  });

  it("maps registration chips to canonical stock units", () => {
    expect(resolveQuantityInputUnit("팩")).toBe("개");
    expect(resolveQuantityInputUnit("리터")).toBe("ml");
    expect(suggestQuantityInputUnit("서울우유", ProductCategory.DAIRY)).toBe(
      "ml",
    );
    expect(suggestQuantityInputUnit("소고기")).toBe("g");
    expect(toBaseQuantity(1, "L")).toEqual({
      quantityBase: 1000,
      unitCode: UnitCode.ML,
    });
    expect(quantityInputStep("ml")).toBe(50);
    expect(defaultQuantityForInputUnit("g")).toBe(100);
    expect(convertQuantityForInputUnit(1, "L", "ml")).toBe(1000);
    expect(convertQuantityForInputUnit(1000, "ml", "L")).toBe(1);
    expect(convertQuantityForInputUnit(2, "개", "ml")).toBe(200);
    expect(quantityValuesForInputUnit({
      quantity: 1,
      fromUnit: "개",
      toUnit: "g",
    })).toEqual({
      quantity: 100,
      unit: "g",
      quantityBase: 100,
      unitCode: UnitCode.G,
    });
    expect(formatEnteredQuantity(1, "L")).toBe("1L");
    expect(quantityInputLabel("ml")).toBe("얼마나 있어요?");
    expect(quantityInputLabel("개", { remaining: true })).toBe("몇 개 남았나요?");
  });
});

describe("partial inventory consume", () => {
  it("allows partial consume only when more than one unit remains", () => {
    expect(canPartiallyConsumeInventoryItem({ quantityBase: 1 })).toBe(false);
    expect(canPartiallyConsumeInventoryItem({ quantityBase: 2 })).toBe(true);
    expect(canPartiallyConsumeInventoryItem({ quantityBase: 500 })).toBe(true);
  });

  it("suggests a leftover-friendly default amount", () => {
    expect(
      defaultPartialConsumeAmount({
        quantityBase: 1000,
        unitCode: UnitCode.ML,
      }),
    ).toBe(200);
    expect(
      defaultPartialConsumeAmount({
        quantityBase: 10,
        unitCode: UnitCode.EA,
      }),
    ).toBe(1);
    expect(
      defaultPartialConsumeAmount({
        quantityBase: 80,
        unitCode: UnitCode.G,
      }),
    ).toBe(40);
  });

  it("decrements canonical stock and keeps pack count for measure lots", () => {
    expect(
      applyConsumedAmountToInventoryItem(
        {
          quantity: 1,
          unit: "팩",
          quantityBase: 500,
          unitCode: UnitCode.ML,
        },
        200,
      ),
    ).toEqual({
      quantity: 1,
      unit: "팩",
      quantityBase: 300,
      unitCode: UnitCode.ML,
    });
  });

  it("keeps count quantity in sync for individual EA lots", () => {
    expect(
      applyConsumedAmountToInventoryItem(
        {
          quantity: 10,
          quantityBase: 10,
          unitCode: UnitCode.EA,
        },
        3,
      ),
    ).toEqual({
      quantity: 7,
      quantityBase: 7,
      unitCode: UnitCode.EA,
    });
  });
});
