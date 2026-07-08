import { describe, expect, it } from "vitest";
import { parseExpirationDate } from "./parseExpirationDate";

describe("parseExpirationDate", () => {
  it("parses full-year dotted dates", () => {
    expect(parseExpirationDate("EXP 2026.05.10")).toBe("2026-05-10");
  });

  it("parses full-year dashed dates", () => {
    expect(parseExpirationDate("유통기한 2026-5-10")).toBe("2026-05-10");
  });

  it("parses compact full-year dates", () => {
    expect(parseExpirationDate("기한:20260510")).toBe("2026-05-10");
  });

  it("parses short-year dates as 20YY", () => {
    expect(parseExpirationDate("26.05.10까지")).toBe("2026-05-10");
  });

  it("parses Korean year-month-day dates after whitespace is removed", () => {
    expect(parseExpirationDate("2026년 05월 10일")).toBe("2026-05-10");
  });

  it("returns the first valid date when an earlier match is invalid", () => {
    expect(parseExpirationDate("2026.13.10 / 2026.05.10")).toBe("2026-05-10");
  });

  it("returns null for impossible dates", () => {
    expect(parseExpirationDate("2026.02.30")).toBeNull();
  });

  it("returns null when no date is present", () => {
    expect(parseExpirationDate("소비기한 별도표기")).toBeNull();
  });
});
