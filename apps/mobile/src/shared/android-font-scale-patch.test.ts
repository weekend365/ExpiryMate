import { createRequire } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { insertFontScaleSourceBuild, insertModuleBuildDirectories, insertActivityConfig, configChangesForManifest } = require("../../plugins/with-android-font-scale-patch.js");
const { prepareSource, prepareWorkletsSource, prepareCmakeSourceReference } = require("../../scripts/prepare-android-font-scale-source.cjs");
const { androidCodegenOverrides } = require("../../scripts/android-codegen-paths.cjs");

describe("Android font-scale source build configuration", () => {
  it("preserves autolinking and unrelated application settings across repeated prebuilds", () => {
    const existing = "rootProject.name = 'Jango'\ninclude ':app'\nexpoAutolinking.useExpoModules()\n";
    const once = insertFontScaleSourceBuild(existing);
    expect(once.startsWith(existing)).toBe(true);
    expect(insertFontScaleSourceBuild(once)).toBe(once);
    expect(once.match(/@generated begin jango-font-scale-native-patch/g)).toHaveLength(1);
  });

  it("requires explicit opt-in while the native fix is under validation", () => {
    const output = insertFontScaleSourceBuild("include ':app'\n");
    expect(output).toContain('gradleProperty("jangoFontScaleNativePatch").orElse("false")');
    expect(output).toContain('module("com.facebook.react:react-android")');
    expect(output).toContain("prepare-android-font-scale-source.cjs");
    const original = "apply plugin: 'expo-root-project'\n";
    const modules = insertModuleBuildDirectories(original);
    expect(modules.startsWith(original)).toBe(true);
    expect(insertModuleBuildDirectories(modules)).toBe(modules);
    // pnpm's patched peer paths affect Prefab even when source compilation is off.
    // Normal builds relocate generated outputs too, while keeping the published AAR.
    expect(modules).not.toContain('gradleProperty("jangoFontScaleNativePatch")');
    expect(modules).toContain('nativeModule.projectDir.canonicalPath.contains("=")');
    expect(modules).toContain("REACT_NATIVE_WORKLETS_NODE_MODULES_DIR");
  });

  it("fails rather than corrupting an incomplete or changed generated template", () => {
    expect(() => insertFontScaleSourceBuild("include ':anotherApp'\n")).toThrow("app include missing");
    expect(() => insertFontScaleSourceBuild("include ':app'\n// @generated begin jango-font-scale-native-patch\n")).toThrow("incomplete generated block");
  });

  it("preserves normal activity handling and routes font changes to RN only in validation builds", () => {
    const existingFlags = "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode";
    const placeholder = configChangesForManifest(existingFlags);
    expect(placeholder).toBe("${jangoFontScaleConfigChanges}");
    expect(configChangesForManifest(placeholder)).toBe(placeholder);
    expect(() => configChangesForManifest(`${existingFlags}|locale`)).toThrow("template changed");
    const original = "android { defaultConfig { manifestPlaceholders = [appAuthRedirectScheme: 'jango'] } }\n";
    const output = insertActivityConfig(original);
    expect(output.startsWith(original)).toBe(true);
    expect(insertActivityConfig(output)).toBe(output);
    expect(output).toContain(`"${existingFlags}" +`);
    expect(output).toContain('orElse("false")');
    expect(output).toContain('? "|fontScale" : ""');
  });

  it("copies patched source out of pnpm paths and invalidates the cache when source changes", () => {
    const root = mkdtempSync(join(tmpdir(), "jango-font-native-"));
    try {
      const source = join(root, "patch_hash=fixture");
      mkdirSync(join(source, "ReactAndroid/build"), { recursive: true });
      writeFileSync(join(source, "SurfaceHandler.cpp"), "dirtyLayout();");
      writeFileSync(join(source, "ReactAndroid/build/generated.txt"), "first build");
      const cache = join(root, "cache");
      const first = prepareSource(source, cache);
      expect(first).not.toContain("=");
      expect(readFileSync(join(first, "SurfaceHandler.cpp"), "utf8")).toBe("dirtyLayout();");
      expect(() => readFileSync(join(first, "ReactAndroid/build/generated.txt"))).toThrow();
      writeFileSync(join(source, "ReactAndroid/build/generated.txt"), "second build");
      expect(prepareSource(source, cache)).toBe(first);
      // RN downloads Hermes here during a real source build. It is a generated
      // dependency archive; it must not invalidate otherwise identical source.
      mkdirSync(join(first, "sdks/download"), { recursive: true });
      writeFileSync(join(first, "sdks/download/hermes.tar.gz"), "downloaded archive");
      expect(prepareSource(source, cache)).toBe(first);
      writeFileSync(join(first, "SurfaceHandler.cpp"), "cache tampering");
      expect(() => prepareSource(source, cache)).toThrow("differs from the installed patch");
      writeFileSync(join(source, "SurfaceHandler.cpp"), "changed source");
      expect(prepareSource(source, cache)).not.toBe(first);
      expect(() => prepareSource(source, join(root, "bad=cache"))).toThrow("must not contain");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps Worklets headers and Reanimated's native library reference in sync with relocated outputs", () => {
    const root = mkdtempSync(join(tmpdir(), "jango-worklets-native-"));
    try {
      const source = join(root, "worklets=fixture");
      mkdirSync(join(source, "Common"), { recursive: true });
      mkdirSync(join(source, "android/src"), { recursive: true });
      writeFileSync(join(source, "Common/header.h"), "installed header");
      const build = join(root, "android-build");
      const reference = prepareWorkletsSource(source, join(root, "cache"), build);
      // Repeat before the target exists: dangling links must remain valid.
      expect(prepareWorkletsSource(source, join(root, "cache"), build)).toBe(reference);
      mkdirSync(build);
      writeFileSync(join(build, "libworklets.so"), "compiled output");
      expect(readFileSync(join(reference, "Common/header.h"), "utf8")).toBe("installed header");
      expect(readFileSync(join(reference, "android/build/libworklets.so"), "utf8")).toBe("compiled output");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves pnpm symlinks and relocates only generated JNI paths with '='", () => {
    const root = mkdtempSync(join(tmpdir(), "jango-codegen-"));
    const libraries = ["@react-native-async-storage/async-storage", "@react-native-community/datetimepicker",
      "@sentry/react-native", "react-native-gesture-handler", "react-native-worklets",
      "react-native-safe-area-context", "react-native-screens", "react-native-svg"];
    try {
      writeFileSync(join(root, "package.json"), "{}");
      for (const [index, name] of libraries.entries()) {
        const source = join(root, index === 0 ? "patched=async-storage" : `ordinary-${index}`);
        mkdirSync(join(source, "android"), { recursive: true });
        writeFileSync(join(source, "package.json"), JSON.stringify({ name }));
        const link = join(root, "node_modules", name);
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(source, link, "dir");
      }
      const config = androidCodegenOverrides(root);
      expect(Object.keys(config)).toEqual([libraries[0]]);
      const androidDir = realpathSync(join(root, "node_modules", libraries[0], "android"));
      expect(resolve(androidDir, config[libraries[0]].platforms.android.cmakeListsPath)).toBe(
        join(root, "android/build/jango-font-scale/react-native-async-storage_async-storage/generated/source/codegen/jni/CMakeLists.txt"),
      );
      expect(config[libraries[0]].platforms.android).not.toHaveProperty("sourceDir");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes relocated paths through the installed Expo autolinker while preserving source CMake libraries", () => {
    const mobileRoot = resolve(__dirname, "../..");
    const mobileRequire = createRequire(join(mobileRoot, "package.json"));
    const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
    const cli = join(dirname(expoRequire.resolve("expo-modules-autolinking/package.json")), "bin/expo-modules-autolinking.js");
    const output = JSON.parse(execFileSync(process.execPath,
      [cli, "react-native-config", "--json", "--platform", "android"], { cwd: mobileRoot, encoding: "utf8" }));
    for (const [name, config] of Object.entries(androidCodegenOverrides(mobileRoot)) as [string, { platforms: { android: { cmakeListsPath: string } } }][]) {
      const android = output.dependencies[name].platforms.android;
      expect(android.cmakeListsPath).toBe(resolve(android.sourceDir, config.platforms.android.cmakeListsPath));
      expect(android.libraryName).toBeTruthy();
      expect(android.packageImportPath).toBeTruthy();
    }
    for (const name of ["react-native-safe-area-context", "react-native-screens", "react-native-svg"]) {
      const android = output.dependencies[name].platforms.android;
      const sourceCmake = join(android.sourceDir, "src/main/jni/CMakeLists.txt");
      if (android.sourceDir.includes("=")) {
        expect(readFileSync(android.cmakeListsPath)).toEqual(readFileSync(sourceCmake));
        expect(readlinkSync(resolve(dirname(android.cmakeListsPath), "../../../build"))).toBe(
          join(mobileRoot, "android/build/jango-font-scale", name),
        );
      } else {
        expect(android.cmakeListsPath).toBe(sourceCmake);
      }
    }
    const reanimated = output.dependencies["react-native-reanimated"].platforms.android;
    expect(reanimated.cmakeListsPath).toBe(join(reanimated.sourceDir, "build/generated/source/codegen/jni/CMakeLists.txt"));
  });

  it("preserves source CMake bytes and connects its relative generated-header path without modifying the package", () => {
    const root = mkdtempSync(join(tmpdir(), "jango-source-cmake-"));
    try {
      const source = join(root, "package=fixture");
      mkdirSync(join(source, "android/src/main/jni"), { recursive: true });
      mkdirSync(join(source, "common/cpp"), { recursive: true });
      const cmake = "set(JNI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../../build/generated/source/codegen/jni)\n";
      writeFileSync(join(source, "android/src/main/jni/CMakeLists.txt"), cmake);
      writeFileSync(join(source, "common/cpp/custom.cpp"), "custom native input");
      const build = join(root, "relocated-build");
      const reference = prepareCmakeSourceReference(source, join(root, "cache"), build);
      expect(prepareCmakeSourceReference(source, join(root, "cache"), build)).toBe(reference);
      mkdirSync(join(build, "generated/source/codegen/jni"), { recursive: true });
      writeFileSync(join(build, "generated/source/codegen/jni/EventEmitters.h"), "generated header");
      expect(readFileSync(join(reference, "android/src/main/jni/CMakeLists.txt"), "utf8")).toBe(cmake);
      expect(readFileSync(join(reference, "common/cpp/custom.cpp"), "utf8")).toBe("custom native input");
      expect(readFileSync(join(reference, "android/build/generated/source/codegen/jni/EventEmitters.h"), "utf8")).toBe("generated header");
      // Keep '..' unnormalized, as in the library's actual CMakeLists.txt.
      expect(readFileSync(`${reference}/android/src/main/jni/../../../build/generated/source/codegen/jni/EventEmitters.h`, "utf8")).toBe("generated header");
      expect(existsSync(join(source, "android/build"))).toBe(false);
      expect(() => prepareCmakeSourceReference(source, join(root, "bad=cache"), build)).toThrow("must not contain");
      writeFileSync(join(reference, "common/cpp/custom.cpp"), "cache tampering");
      expect(() => prepareCmakeSourceReference(source, join(root, "cache"), build)).toThrow("differs from the installed package");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
