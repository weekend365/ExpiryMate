import { describe, expect, it } from "vitest";
import {
  addDaysToDateOnly,
  calculateDaysLeftUntilExpiry,
  isDateOnlyString,
  toIsoDate,
  toKstDateOnly,
} from "./date";

describe("date-only utilities", () => {
  it("normalizes instants to KST YYYY-MM-DD", () => {
    expect(toKstDateOnly("2026-06-09T14:59:59.000Z")).toBe("2026-06-09");
    expect(toKstDateOnly("2026-06-09T15:00:00.000Z")).toBe("2026-06-10");
    expect(toIsoDate("2026-06-10")).toBe("2026-06-10");
  });

  it("calculates expiry days by KST calendar date", () => {
    const now = new Date("2026-06-09T15:00:00.000Z");

    expect(calculateDaysLeftUntilExpiry("2026-06-09", now)).toBe(-1);
    expect(calculateDaysLeftUntilExpiry("2026-06-10", now)).toBe(0);
    expect(calculateDaysLeftUntilExpiry("2026-06-12", now)).toBe(2);
  });

  it("adds days and validates real date-only strings", () => {
    expect(addDaysToDateOnly("2026-02-28", 1)).toBe("2026-03-01");
    expect(isDateOnlyString("2026-02-29")).toBe(false);
    expect(isDateOnlyString("2028-02-29")).toBe(true);
  });
});
