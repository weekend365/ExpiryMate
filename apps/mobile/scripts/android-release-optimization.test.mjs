import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { enableOptimizedProguard } = require("../plugins/with-android-release-optimization.js");

describe("Android release ProGuard template migration", () => {
  it.each(['"', "'"])("replaces the legacy default with %s quoting without losing custom rules", (quote) => {
    const source = `proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), "proguard-rules.pro"`;
    const result = enableOptimizedProguard(source);
    expect(result).toBe('proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"');
    expect(enableOptimizedProguard(result)).toBe(result);
  });

  it("fails visibly when a future template no longer has the expected default", () => {
    expect(() => enableOptimizedProguard('proguardFiles "custom.pro"')).toThrow(/not found/);
  });
});
