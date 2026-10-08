import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { enableOptimizedProguard } = require("../plugins/with-android-release-optimization.js");

describe("Android SecureStore release compatibility", () => {
  it("disables R8 and resource shrinking together until native session QA passes", () => {
    const appConfig = JSON.parse(
      readFileSync(new URL("../app.json", import.meta.url), "utf8"),
    );
    const buildProperties = appConfig.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
    );

    // SDK 54's Record conversion uses Kotlin reflection. The 1.4.1 release
    // rejected SecureStoreOptions with an NPE while R8 was enabled.
    expect(buildProperties[1].android.enableMinifyInReleaseBuilds).toBe(false);
    expect(buildProperties[1].android.enableShrinkResourcesInReleaseBuilds).toBe(false);
  });
});

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
