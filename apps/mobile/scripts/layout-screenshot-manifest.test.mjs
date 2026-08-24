import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getLayoutProfile,
  layoutProfiles,
  layoutScreenshotNames,
} from "./layout-screenshot-manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

describe("layout screenshot manifest", () => {
  it("covers default, navigation, large text, and combined stress profiles", () => {
    expect(Object.keys(layoutProfiles)).toEqual([
      "small-three-button",
      "modern-gesture",
      "small-large-text",
      "large-display-large-text",
    ]);
    expect(getLayoutProfile("large-display-large-text")).toMatchObject({
      width: 824,
      height: 1830,
    });
  });

  it("requires every responsive smoke capture exactly once", () => {
    expect(new Set(layoutScreenshotNames).size).toBe(layoutScreenshotNames.length);
    expect(layoutScreenshotNames).toEqual([
      "home.png",
      "inventory.png",
      "register-keyboard.png",
      "scanner-permission-denied.png",
      "scanner.png",
      "recommendations.png",
      "recommendation-options.png",
      "settings.png",
    ]);

    const flow = readFileSync(
      resolve(scriptDir, "../.maestro/layout-smoke.yaml"),
      "utf8",
    );
    const flowCaptures = [...flow.matchAll(/takeScreenshot:\s*\$\{SCREENSHOT_DIR\}\/([^\s]+)/g)]
      .map((match) => `${match[1]}.png`);
    expect(flowCaptures).toEqual(layoutScreenshotNames);
  });

  it("rejects unknown profiles", () => {
    expect(() => getLayoutProfile("unknown")).toThrow("Unknown layout profile");
  });
});
