import { afterEach, describe, expect, it, vi } from "vitest";
import { getNonNegativeIntegerEnv, getNonNegativeNumberEnv } from "./number-env";

const envKey = "REFACTOR_TEST_NUMERIC_LIMIT";
afterEach(() => vi.unstubAllEnvs());

describe("non-negative numeric environment values", () => {
  it.each([undefined, "", "-1", "invalid", "NaN", "Infinity", "-Infinity"])(
    "uses the caller's fallback for %j",
    (value) => {
      vi.stubEnv(envKey, value);
      expect(getNonNegativeNumberEnv(envKey, 3.75)).toBe(3.75);
      expect(getNonNegativeIntegerEnv(envKey, 3.75)).toBe(3);
    },
  );

  it.each([
    ["0", 0, 0],
    ["0.125", 0.125, 0],
    ["2.75", 2.75, 2],
    [" 4.5 ", 4.5, 4],
    ["1e2", 100, 100],
    [" ", 0, 0],
  ])("preserves numeric coercion for %j", (value, number, integer) => {
    vi.stubEnv(envKey, value);
    expect(getNonNegativeNumberEnv(envKey, 9)).toBe(number);
    expect(getNonNegativeIntegerEnv(envKey, 9)).toBe(integer);
  });

  it("reads updated environment values at call time", () => {
    vi.stubEnv(envKey, "1");
    expect(getNonNegativeNumberEnv(envKey, 9)).toBe(1);
    vi.stubEnv(envKey, "2");
    expect(getNonNegativeNumberEnv(envKey, 9)).toBe(2);
  });
});
