import { describe, expect, it } from "vitest";
import { ExpirySource, UnitCode } from "../enums/app-enums";
import {
  formatBaseQuantity,
  formatInventoryQuantity,
  inferUnitCode,
  inventoryItemToFormValues,
  resolveCanonicalQuantityUpdate,
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
});
