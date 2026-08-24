import { describe, expect, it } from "vitest";
import {
  classifyScreenshotDiff,
  getCaptureContractIssues,
  hasExpectedDimensions,
} from "./screenshot-comparison-core.mjs";

describe("screenshot comparison contract", () => {
  it("reports missing and unexpected captures", () => {
    expect(
      getCaptureContractIssues(
        ["home.png", "extra.png"],
        ["home.png", "inventory.png"],
      ),
    ).toEqual([
      { file: "inventory.png", status: "missing-current" },
      { file: "extra.png", status: "unexpected-current" },
    ]);
  });

  it("requires the physical dimensions declared by the profile", () => {
    expect(
      hasExpectedDimensions(
        { width: 824, height: 1830 },
        { width: 824, height: 1830 },
      ),
    ).toBe(true);
    expect(
      hasExpectedDimensions(
        { width: 720, height: 1280 },
        { width: 824, height: 1830 },
      ),
    ).toBe(false);
  });

  it("separates accepted noise, reviewable changes, and regressions", () => {
    expect(classifyScreenshotDiff(0.00005, 0.005, 0.0001)).toBe("accepted");
    expect(classifyScreenshotDiff(0.001, 0.005, 0.0001)).toBe("changed");
    expect(classifyScreenshotDiff(0.006, 0.005, 0.0001)).toBe("regression");
  });
});
