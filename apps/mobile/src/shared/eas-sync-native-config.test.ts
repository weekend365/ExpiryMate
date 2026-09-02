import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { syncNativeConfigOnEas } = require("../../scripts/eas-sync-native-config.cjs");

describe("EAS native config sync", () => {
  it("runs prebuild during package installation, before the EAS iOS pod step", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts.postinstall).toContain("eas-sync-native-config.cjs");
    expect(packageJson.scripts["eas-build-post-install"]).not.toContain(
      "eas-sync-native-config.cjs",
    );
    expect(
      packageJson.dependencies?.["@sentry/cli"] ??
        packageJson.devDependencies?.["@sentry/cli"],
    ).toBe("2.55.0");
  });

  it("does not rewrite native files outside an iOS EAS worker", () => {
    expect(syncNativeConfigOnEas({ EAS_BUILD: "false" })).toEqual({
      skipped: true,
    });
    expect(
      syncNativeConfigOnEas({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android" }),
    ).toEqual({ skipped: true });
  });
});
