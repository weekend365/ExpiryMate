import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getLayoutProfile,
  layoutProfiles,
  layoutRouteScreenshots,
  layoutScreenshotNames,
} from "./layout-screenshot-manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "../app");

function findRouteFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory()
      ? findRouteFiles(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

function routeName(path) {
  const relativePath = path.slice(appDir.length + 1).replace(/\.tsx$/, "");
  return relativePath.endsWith("/index")
    ? relativePath.slice(0, -"/index".length)
    : relativePath;
}

describe("layout screenshot manifest", () => {
  it("covers default, navigation, large text, and combined stress profiles", () => {
    expect(Object.keys(layoutProfiles)).toEqual([
      "small-three-button",
      "modern-gesture",
      "small-large-text",
      "large-display-large-text",
      "phone-landscape",
      "phone-landscape-large-text",
      "ios-small",
      "ios-small-large-text",
      "tablet-landscape",
      "foldable-portrait",
    ]);
    expect(getLayoutProfile("large-display-large-text")).toMatchObject({
      width: 824,
      height: 1830,
    });
    expect(getLayoutProfile("phone-landscape")).toMatchObject({
      width: 1280,
      height: 720,
    });
    expect(getLayoutProfile("ios-small-large-text")).toMatchObject({
      width: 750,
      height: 1334,
    });
    expect(getLayoutProfile("tablet-landscape")).toMatchObject({
      width: 1600,
      height: 1200,
    });
    expect(getLayoutProfile("foldable-portrait")).toMatchObject({
      width: 1600,
      height: 2560,
    });
  });

  it("requires every responsive smoke capture exactly once", () => {
    expect(new Set(layoutScreenshotNames).size).toBe(layoutScreenshotNames.length);
    expect(layoutScreenshotNames).toEqual([
      "onboarding.png",
      "login.png",
      "forgot-password.png",
      "auth-register.png",
      "reset-password.png",
      "verify-pending.png",
      "verify-email.png",
      "home.png",
      "inventory.png",
      "inventory-edit.png",
      "register-keyboard.png",
      "scanner-permission-denied.png",
      "scanner.png",
      "recommendations.png",
      "recommendation-options.png",
      "settings.png",
      "subscription.png",
      "insights.png",
      "shopping.png",
      "register-photo.png",
      "cooking.png",
      "privacy.png",
      "ai-data-notice.png",
      "account-delete.png",
      "settings-account.png",
      "settings-notifications.png",
      "settings-recipe-preferences.png",
      "settings-recommendation-credits.png",
      "settings-spaces.png",
      "settings-space-detail.png",
      "settings-storage-locations.png",
      "settings-support.png",
      "invitation-code.png",
      "invitation-accept.png",
    ]);

    const flow = readFileSync(
      resolve(scriptDir, "../.maestro/layout-smoke.yaml"),
      "utf8",
    );
    const flowCaptures = [...flow.matchAll(/takeScreenshot:\s*\$\{SCREENSHOT_DIR\}\/([^\s]+)/g)]
      .map((match) => `${match[1]}.png`);
    expect(flowCaptures).toEqual(layoutScreenshotNames);
  });

  it("assigns a canonical screenshot to every user-facing route", () => {
    const routeFiles = findRouteFiles(appDir)
      .map(routeName)
      .filter((route) => route !== "index" && !route.endsWith("_layout"))
      .sort();

    expect(Object.keys(layoutRouteScreenshots).sort()).toEqual(routeFiles);
    expect(Object.values(layoutRouteScreenshots).every((screenshot) =>
      layoutScreenshotNames.includes(screenshot),
    )).toBe(true);
  });

  it("rejects unknown profiles", () => {
    expect(() => getLayoutProfile("unknown")).toThrow("Unknown layout profile");
  });
});
