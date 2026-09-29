import { describe, expect, it } from "vitest";
import {
  createShoppingItemSchema,
  normalizeShoppingName,
  updateShoppingItemSchema,
} from "./shopping";
describe("shopping contracts", () => {
  it("normalizes duplicate names without combining different names", () => {
    expect(normalizeShoppingName("  두부   １모  ")).toBe("두부 1모");
    expect(normalizeShoppingName("MILK")).toBe(normalizeShoppingName("milk"));
    expect(normalizeShoppingName("두부")).not.toBe(
      normalizeShoppingName("순두부"),
    );
  });
  it("rejects blank names, invalid quantities and unversioned writes", () => {
    for (const quantity of [0, -1, 1.5, 10000])
      expect(
        createShoppingItemSchema.safeParse({
          name: "두부",
          quantity,
          unit: "개",
        }).success,
      ).toBe(false);
    expect(
      createShoppingItemSchema.safeParse({ name: " ", quantity: 1, unit: "개" })
        .success,
    ).toBe(false);
    expect(
      updateShoppingItemSchema.safeParse({ completed: true }).success,
    ).toBe(false);
    expect(
      updateShoppingItemSchema.parse({ completed: true, expectedVersion: 2 }),
    ).toEqual({ completed: true, expectedVersion: 2 });
  });
});
