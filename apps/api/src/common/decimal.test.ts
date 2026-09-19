import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { decimalToNumber } from "./decimal";

describe("decimalToNumber", () => {
  it.each([
    [null, 0],
    [{}, 0],
    [0, 0],
    [-0.25, -0.25],
    ["0.125", 0.125],
    ["-0.25", -0.25],
    ["invalid", 0],
    ["Infinity", 0],
    ["NaN", 0],
    ["", 0],
    [new Prisma.Decimal("0.0625"), 0.0625],
  ])("converts %j to %j", (value, expected) => {
    expect(decimalToNumber(value)).toBe(expected);
  });

  it("preserves number and toNumber results without adding validation", () => {
    expect(decimalToNumber(Infinity)).toBe(Infinity);
    expect(decimalToNumber(NaN)).toBeNaN();
    expect(decimalToNumber({ toNumber: () => Infinity })).toBe(Infinity);
    expect(decimalToNumber({ toNumber: () => NaN })).toBeNaN();
  });

  it("preserves the toNumber receiver and propagates conversion errors", () => {
    const value = { amount: 0.125, toNumber() { return this.amount; } };
    expect(decimalToNumber(value)).toBe(0.125);
    const error = new Error("conversion failed");
    expect(() => decimalToNumber({ toNumber() { throw error; } })).toThrow(error);
  });
});
