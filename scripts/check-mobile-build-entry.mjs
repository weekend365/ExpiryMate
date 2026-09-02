import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const forbiddenRootConfigs = ["app.json", "app.config.js", "eas.json"];
const unexpected = forbiddenRootConfigs.filter((name) =>
  existsSync(resolve(repositoryRoot, name)),
);

if (unexpected.length > 0) {
  throw new Error(
    `Expo/EAS configuration must live only in apps/mobile. Remove: ${unexpected.join(", ")}`,
  );
}

const mobileApp = JSON.parse(
  readFileSync(resolve(repositoryRoot, "apps/mobile/app.json"), "utf8"),
).expo;
const mobileEas = JSON.parse(
  readFileSync(resolve(repositoryRoot, "apps/mobile/eas.json"), "utf8"),
);

if (mobileApp.ios?.bundleIdentifier !== "com.expirymate.mobile") {
  throw new Error("Unexpected production iOS bundle identifier.");
}

if (mobileApp.extra?.eas?.projectId !== "6c64c29f-a2bb-4416-99c3-0b4d88898ea6") {
  throw new Error("Unexpected production EAS project id.");
}

if (mobileEas.submit?.production?.ios?.bundleIdentifier !== mobileApp.ios.bundleIdentifier) {
  throw new Error("EAS submit bundle identifier does not match the mobile app config.");
}

console.log("Mobile Expo/EAS build entry is canonical and unambiguous.");
