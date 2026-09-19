import { describe, expect, it } from "vitest";
import { toDatePickerDate, toDatePickerDateOnly } from "./date-picker";

describe("native date picker calendar conversion", () => {
  // Run this suite with TZ=UTC, Asia/Seoul, and America/Los_Angeles.
  it.each([
    "2024-02-29",
    "2026-01-31",
    "2026-04-30",
    "2026-12-31",
    "2026-03-08",
    "2026-11-01",
  ])("round-trips %s at local midnight", (value) => {
    const date = toDatePickerDate(value);
    const [year, month, day] = value.split("-").map(Number);

    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([
      year, month, day,
    ]);
    expect(date.getHours()).toBe(0);
    expect(toDatePickerDateOnly(date)).toBe(value);
  });

  it("formats the local calendar day and leaves the input unchanged", () => {
    const date = new Date(2026, 0, 2, 23, 59, 59);
    const timestamp = date.getTime();

    expect(toDatePickerDateOnly(date)).toBe("2026-01-02");
    expect(date.getTime()).toBe(timestamp);
  });

  it.each([
    "2026-01-01T23:30:00.000Z",
    "2026-01-02T00:30:00+09:00",
    "2026-02-30",
    "invalid-date",
    "",
  ])("preserves the Date constructor fallback for %j", (value) => {
    expect(toDatePickerDate(value).getTime()).toBe(new Date(value).getTime());
  });
});
