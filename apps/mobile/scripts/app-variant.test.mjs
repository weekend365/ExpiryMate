import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { QA, resolveAppVariant } = require("./app-variant.cjs");
const { configureProject, configureInfo, configurePodfile } = require("../plugins/with-ios-app-variants.js");
const withVariants = require("../plugins/with-ios-app-variants.js");
const { compileModsAsync, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

describe("side-by-side development app", () => {
  it("keeps the default production identity and rejects unsafe variants", () => {
    expect(resolveAppVariant({})).toBe("production");
    expect(resolveAppVariant({ APP_VARIANT: "development" })).toBe("development");
    expect(() => resolveAppVariant({ APP_VARIANT: "typo" })).toThrow("Unknown");
    for (const env of ["production", "preview"]) {
      expect(() => resolveAppVariant({ APP_VARIANT: "development", EXPO_PUBLIC_APP_ENV: env })).toThrow("cannot");
    }
  });

  it("isolates app URLs while preserving provider callbacks, idempotently", () => {
    const info = { CFBundleURLTypes: [{ CFBundleURLSchemes: ["expirymate", "exp+expirymate", QA.scheme, "provider-callback"] }] };
    const result = configureInfo(info);
    expect(result.CFBundleURLTypes).toEqual([
      { CFBundleURLSchemes: ["$(JANGO_APP_SCHEME)", "$(PRODUCT_BUNDLE_IDENTIFIER)"] },
      { CFBundleURLSchemes: ["provider-callback"] },
    ]);
    expect(configureInfo(structuredClone(result))).toEqual(result);
  });

  it("adds QA configs without changing production signing or duplicating configs", () => {
    const objects = {
      XCBuildConfiguration: {
        debug: { name: "Debug", buildSettings: { DEVELOPMENT_TEAM: "existing-team", PRODUCT_BUNDLE_IDENTIFIER: "old-id" } },
        release: { name: "Release", buildSettings: { DEVELOPMENT_TEAM: "existing-team" } },
      },
      XCConfigurationList: { target: { buildConfigurations: [{ value: "debug", comment: "Debug" }, { value: "release", comment: "Release" }] } },
    };
    let id = 0;
    const project = { hash: { project: { objects } }, getFirstTarget: () => ({ firstTarget: { buildConfigurationList: "target" } }), generateUuid: () => `qa${++id}` };
    configureProject(project);
    const qaRef = objects.XCConfigurationList.target.buildConfigurations.find((ref) => ref.comment === "Debug-QA");
    objects.XCBuildConfiguration[qaRef.value].baseConfigurationReference = "pods-debug-qa";
    configureProject(project);
    expect(objects.XCConfigurationList.target.buildConfigurations).toHaveLength(4);
    expect(objects.XCBuildConfiguration.debug.buildSettings.PRODUCT_BUNDLE_IDENTIFIER).toBe("com.expirymate.mobile");
    expect(objects.XCBuildConfiguration[qaRef.value].buildSettings.PRODUCT_BUNDLE_IDENTIFIER).toBe(QA.id);
    expect(objects.XCBuildConfiguration[qaRef.value].buildSettings.DEVELOPMENT_TEAM).toBe("existing-team");
    expect(objects.XCBuildConfiguration[qaRef.value].baseConfigurationReference).toBe("pods-debug-qa");
  });

  it("maps QA CocoaPods configurations exactly once", () => {
    const result = configurePodfile("prepare_react_native_project!\n");
    expect(configurePodfile(result)).toBe(result);
    expect(result).toContain("'Debug-QA' => :debug");
    expect(result).toContain("'Release-QA' => :release");
  });

  it("selects QA schemes only for development EAS builds", () => {
    const config = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8"));
    for (const name of ["development", "development-device"]) {
      expect(config.build[name].developmentClient).toBe(true);
      expect(config.build[name].ios.scheme).toBe("ExpiryMateQA");
      expect(config.build[name].ios.buildConfiguration).toBe("Debug-QA");
      expect(config.build[name].env.APP_VARIANT).toBe("development");
    }
    expect(config.build.production.ios.scheme).toBe("ExpiryMate");
    expect(config.submit.production.ios.bundleIdentifier).toBe("com.expirymate.mobile");
  });

  it("wins over ordinary Prebuild identity mods and regenerates identical files", async () => {
    const root = mkdtempSync(join(tmpdir(), "jango-variant-test-"));
    const files = ["ExpiryMate/Info.plist", "ExpiryMate.xcodeproj/project.pbxproj", "ExpiryMate.xcodeproj/xcshareddata/xcschemes/ExpiryMate.xcscheme", "Podfile"];
    try {
      for (const file of files) {
        mkdirSync(join(root, "ios", file, ".."), { recursive: true });
        copyFileSync(new URL(`../ios/${file}`, import.meta.url), join(root, "ios", file));
      }
      const generate = async () => {
        let config = structuredClone(require("../app.json").expo);
        config = withInfoPlist(config, (mod) => {
          mod.modResults.CFBundleDisplayName = "would overwrite QA";
          return mod;
        });
        config = withXcodeProject(config, (mod) => {
          const objects = mod.modResults.hash.project.objects;
          for (const item of Object.values(objects.XCBuildConfiguration)) {
            if (typeof item === "object" && item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = "would.overwrite.production";
          }
          return mod;
        });
        await compileModsAsync(withVariants(config), { projectRoot: root, platforms: ["ios"] });
      };
      await generate();
      const before = files.map((file) => readFileSync(join(root, "ios", file), "utf8"));
      expect(before[0]).toContain("$(JANGO_APP_DISPLAY_NAME)");
      expect(before[1]).toContain("PRODUCT_BUNDLE_IDENTIFIER = com.expirymate.mobile;");
      expect(before[1]).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${QA.id};`);
      expect(before[1]).not.toContain("would.overwrite.production");
      const scheme = readFileSync(join(root, "ios/ExpiryMate.xcodeproj/xcshareddata/xcschemes/ExpiryMateQA.xcscheme"), "utf8");
      expect(scheme).toMatch(/buildConfiguration\s*=\s*"Debug-QA"/);
      await generate();
      expect(files.map((file) => readFileSync(join(root, "ios", file), "utf8"))).toEqual(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
