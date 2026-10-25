import { describe, expect, it } from "vitest";
import { getHomeHeroDensity } from "./home-hero-density";

describe("home hero density", () => {
  it.each([
    [320, 1, "default"],
    [360, 1.15, "default"],
    [360, 1.2999, "default"],
    [320, 1.3, "compact"],
    [360, 1.2999999523162842, "compact"],
    [399, 2, "compact"],
    [400, 1.3, "default"],
    [768, 2, "default"],
    [780, 2, "default"],
  ] as const)("uses the approved home-only rule at width %s and font scale %s", (width, scale, expected) => {
    expect(getHomeHeroDensity(width, scale)).toBe(expected);
  });
});
