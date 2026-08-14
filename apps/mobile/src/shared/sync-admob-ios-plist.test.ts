import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  GOOGLE_TEST_IOS_APP_ID,
  resolveIosAdMobAppId,
  syncAdMobIosPlist,
} = require("../../scripts/sync-admob-ios-plist.cjs");

const SAMPLE_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>장고야 부탁해</string>
  </dict>
</plist>
`;

describe("syncAdMobIosPlist", () => {
  it("uses the Google sample App ID outside production", () => {
    expect(resolveIosAdMobAppId({ EXPO_PUBLIC_APP_ENV: "development" })).toBe(
      GOOGLE_TEST_IOS_APP_ID,
    );
  });

  it("writes GADApplicationIdentifier and delays measurement init", () => {
    const { plistContents, appId } = syncAdMobIosPlist({
      plistContents: SAMPLE_PLIST,
      env: { EXPO_PUBLIC_APP_ENV: "preview" },
    });

    expect(appId).toBe(GOOGLE_TEST_IOS_APP_ID);
    expect(plistContents).toContain(
      `<key>GADApplicationIdentifier</key>\n    <string>${GOOGLE_TEST_IOS_APP_ID}</string>`,
    );
    expect(plistContents).toContain(
      "<key>GADDelayAppMeasurementInit</key>\n    <true/>",
    );
  });

  it("replaces an existing App ID with the production value", () => {
    const seeded = syncAdMobIosPlist({
      plistContents: SAMPLE_PLIST,
      env: { EXPO_PUBLIC_APP_ENV: "development" },
    }).plistContents;
    const productionId = "ca-app-pub-1234567890123456~1234567890";
    const { plistContents, appId } = syncAdMobIosPlist({
      plistContents: seeded,
      env: {
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_ADMOB_IOS_APP_ID: productionId,
      },
    });

    expect(appId).toBe(productionId);
    expect(plistContents).toContain(
      `<key>GADApplicationIdentifier</key>\n    <string>${productionId}</string>`,
    );
    expect(plistContents).not.toContain(GOOGLE_TEST_IOS_APP_ID);
  });

  it("rejects a missing or sample production App ID", () => {
    expect(() =>
      resolveIosAdMobAppId({ EXPO_PUBLIC_APP_ENV: "production" }),
    ).toThrow(/EXPO_PUBLIC_ADMOB_IOS_APP_ID/);

    expect(() =>
      resolveIosAdMobAppId({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_ADMOB_IOS_APP_ID: GOOGLE_TEST_IOS_APP_ID,
      }),
    ).toThrow(/sample App ID/);
  });
});
