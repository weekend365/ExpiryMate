import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { syncNativeConfigOnEas, reviewedBrandingFiles } = require("../../scripts/eas-sync-native-config.cjs");

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

  it("preserves reviewed icon and splash bytes while keeping regenerated native config", () => {
    const mobileRoot = mkdtempSync(join(tmpdir(), "jango-eas-branding-"));
    try {
      const assets = (reviewedBrandingFiles as string[]).map(relative =>
        join(mobileRoot, "ios/ExpiryMate/Images.xcassets", relative),
      );
      for (const filename of assets) {
        mkdirSync(dirname(filename), { recursive: true });
        writeFileSync(filename, "reviewed derivative");
      }
      const info = join(mobileRoot, "ios/ExpiryMate/Info.plist");
      writeFileSync(info, "old version");
      const result = syncNativeConfigOnEas(
        { EAS_BUILD: "true", EAS_BUILD_PLATFORM: "ios" },
        { mobileRoot, spawn: () => {
          for (const filename of assets) writeFileSync(filename, "prebuild resample");
          writeFileSync(info, "new version and capabilities");
          return { status: 0 };
        } },
      );
      expect(result).toEqual({ skipped: false });
      for (const filename of assets) expect(readFileSync(filename, "utf8")).toBe("reviewed derivative");
      expect(readFileSync(info, "utf8")).toBe("new version and capabilities");
    } finally {
      rmSync(mobileRoot, { recursive: true, force: true });
    }
  });
});
