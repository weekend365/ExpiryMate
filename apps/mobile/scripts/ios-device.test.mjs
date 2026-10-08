import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { selectPhysicalDevice, parseOptions, buildAndInstall } = require("./ios-device.cjs");
const { QA } = require("./app-variant.cjs");
const phone = { identifier: "core-device", hardwareProperties: { reality: "physical", deviceType: "iPhone", udid: "phone-udid" }, connectionProperties: { pairingState: "paired" }, deviceProperties: { name: "My iPhone" } };
const settings = { PRODUCT_BUNDLE_IDENTIFIER: QA.id, JANGO_APP_SCHEME: QA.scheme, CONFIGURATION: "Debug-QA", TARGET_BUILD_DIR: "/tmp/test-build", FULL_PRODUCT_NAME: "app.app" };

describe("physical iPhone development build", () => {
  it("ignores simulators and resolves a paired iPhone by name or UDID", () => {
    const simulator = { ...phone, hardwareProperties: { ...phone.hardwareProperties, reality: "simulated" } };
    expect(selectPhysicalDevice([simulator, phone])).toBe(phone);
    expect(selectPhysicalDevice([phone], "my iphone")).toBe(phone);
    expect(selectPhysicalDevice([phone], "phone-udid")).toBe(phone);
    expect(() => selectPhysicalDevice([simulator])).toThrow("실물 iPhone");
    expect(() => selectPhysicalDevice([phone, { ...phone, identifier: "second" }])).toThrow("여러 대");
  });

  it("rejects build overrides and missing device values", () => {
    expect(parseOptions(["--check", "--device", "My iPhone"])).toEqual({ check: true, device: "My iPhone" });
    expect(() => parseOptions(["--device"])).toThrow("옵션");
    expect(() => parseOptions(["--configuration", "Release"])).toThrow("옵션");
  });

  it("checks the real-device configuration without invoking Simulator or installing", () => {
    const calls = [];
    const result = buildAndInstall({ root: "/repo", device: phone, check: true, run: (command, args) => {
      calls.push({ command, args });
      return JSON.stringify([{ target: "ExpiryMate", buildSettings: settings }]);
    } });
    expect(result.installed).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("xcodebuild");
    expect(calls[0].args).toContain("id=phone-udid");
    expect(calls[0].args).toContain("Debug-QA");
    expect(calls[0].args).toContain("IPHONEOS_DEPLOYMENT_TARGET=16.4");
  });

  it("never installs when signing/building fails or the artifact is a production app", () => {
    for (const failure of ["build", "artifact", "settings"]) {
      const calls = [];
      const run = (command, args) => {
        calls.push({ command, args });
        if (args.includes("-showBuildSettings")) return JSON.stringify([{ target: "ExpiryMate", buildSettings: { ...settings, ...(failure === "settings" ? { PRODUCT_BUNDLE_IDENTIFIER: "com.expirymate.mobile" } : {}) } }]);
        if (command === "xcodebuild" && failure === "build") throw new Error("signing failed");
        if (command === "/usr/libexec/PlistBuddy") return "com.expirymate.mobile\n";
        return "";
      };
      expect(() => buildAndInstall({ root: "/repo", device: phone, run, exists: () => true })).toThrow();
      expect(calls.some((call) => call.command === "xcrun")).toBe(false);
    }
  });

  it("installs the verified QA binary with CoreDevice, without Expo run:ios", () => {
    const calls = [];
    const run = (command, args) => {
      calls.push({ command, args });
      if (args.includes("-showBuildSettings")) return JSON.stringify([{ target: "ExpiryMate", buildSettings: settings }]);
      if (command === "/usr/libexec/PlistBuddy") return QA.id;
      return "";
    };
    expect(buildAndInstall({ root: "/repo", device: phone, run, exists: () => true }).installed).toBe(true);
    expect(calls.at(-1)).toEqual({ command: "xcrun", args: ["devicectl", "device", "install", "app", "--device", "core-device", "/tmp/test-build/app.app"] });
  });
});
