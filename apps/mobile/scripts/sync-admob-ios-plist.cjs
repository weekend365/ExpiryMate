const fs = require("node:fs");
const path = require("node:path");

const GOOGLE_TEST_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const DEFAULT_PLIST_PATH = path.join(
  __dirname,
  "..",
  "ios",
  "ExpiryMate",
  "Info.plist",
);

function resolveIosAdMobAppId(env = process.env) {
  const configured = env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim();
  if (env.EXPO_PUBLIC_APP_ENV === "production") {
    if (!configured) {
      throw new Error(
        "EXPO_PUBLIC_ADMOB_IOS_APP_ID is required to write GADApplicationIdentifier for production iOS builds.",
      );
    }
    if (configured === GOOGLE_TEST_IOS_APP_ID) {
      throw new Error(
        "EXPO_PUBLIC_ADMOB_IOS_APP_ID must not use Google's sample App ID in production.",
      );
    }
    return configured;
  }

  return configured || GOOGLE_TEST_IOS_APP_ID;
}

function upsertPlistEntry(xml, key, valueXml) {
  const keyTag = `<key>${key}</key>`;
  const keyIndex = xml.indexOf(keyTag);

  if (keyIndex !== -1) {
    const afterKey = xml.slice(keyIndex + keyTag.length);
    const valueMatch = afterKey.match(
      /^\s*(<string>[\s\S]*?<\/string>|<true\s*\/>|<false\s*\/>)/,
    );

    if (!valueMatch) {
      throw new Error(`Could not find a plist value for ${key}.`);
    }

    const end = keyIndex + keyTag.length + valueMatch[0].length;
    return `${xml.slice(0, keyIndex)}${keyTag}\n    ${valueXml}${xml.slice(end)}`;
  }

  const close = xml.lastIndexOf("</dict>");
  if (close === -1) {
    throw new Error("Info.plist is missing a closing </dict>.");
  }

  return `${xml.slice(0, close)}    ${keyTag}\n    ${valueXml}\n${xml.slice(close)}`;
}

function syncAdMobIosPlist({
  plistContents,
  env = process.env,
} = {}) {
  const appId = resolveIosAdMobAppId(env);
  let next = plistContents;
  next = upsertPlistEntry(
    next,
    "GADApplicationIdentifier",
    `<string>${appId}</string>`,
  );
  next = upsertPlistEntry(next, "GADDelayAppMeasurementInit", "<true/>");
  return { plistContents: next, appId };
}

function writeAdMobIosPlist({
  plistPath = DEFAULT_PLIST_PATH,
  env = process.env,
} = {}) {
  const current = fs.readFileSync(plistPath, "utf8");
  const { plistContents, appId } = syncAdMobIosPlist({
    plistContents: current,
    env,
  });
  fs.writeFileSync(plistPath, plistContents);
  return { plistPath, appId };
}

if (require.main === module) {
  try {
    const result = writeAdMobIosPlist();
    console.log(
      `Wrote GADApplicationIdentifier (${result.appId}) to ${result.plistPath}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  GOOGLE_TEST_IOS_APP_ID,
  resolveIosAdMobAppId,
  syncAdMobIosPlist,
  upsertPlistEntry,
  writeAdMobIosPlist,
};
