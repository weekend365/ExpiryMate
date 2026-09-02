import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appConfig = JSON.parse(
  readFileSync(resolve(scriptDir, "../app.json"), "utf8"),
);
const dynamicAppConfig = readFileSync(
  resolve(scriptDir, "../app.config.js"),
  "utf8",
);

describe("Android adaptive-window app configuration", () => {
  it("does not request a global portrait lock", () => {
    expect(appConfig.expo.orientation).toBe("default");
  });

  it("uses the system Photo Picker without broad media permissions", () => {
    expect(appConfig.expo.android.permissions).toEqual(["CAMERA"]);
    expect(appConfig.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
      ]),
    );
  });

  it("falls back to the compiled Google Mobile Ads config plugin", () => {
    expect(dynamicAppConfig).toContain(
      'require.resolve("react-native-google-mobile-ads/app.plugin.js")',
    );
    expect(dynamicAppConfig).toContain(
      'return "react-native-google-mobile-ads/plugin/build"',
    );
  });
});

describe("Sentry build upload configuration", () => {
  it("uploads source maps and debug symbols to the production mobile project", () => {
    const sentryPlugin = appConfig.expo.plugins.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "@sentry/react-native",
    );

    expect(sentryPlugin).toEqual([
      "@sentry/react-native",
      {
        organization: "devnamu",
        project: "jango-mobile",
        disableAutoUpload: false,
      },
    ]);
  });
});
