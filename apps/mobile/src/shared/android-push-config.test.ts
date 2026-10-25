import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { resolveAndroidGoogleServicesFile } = require("../../scripts/android-push-config.cjs");
const temporary: string[] = [];
const packageName = "com.expirymate.mobile";
const clientConfig = () => ({
  project_info: { project_number: "123456789", project_id: "test-project" },
  client: [{ client_info: { mobilesdk_app_id: "1:123456789:android:abcdef",
    android_client_info: { package_name: packageName } }, api_key: [{ current_key: "synthetic-public-client-key" }] }],
});
function file(value: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "jango-push-config-"));
  temporary.push(directory);
  const filename = join(directory, "google-services.json");
  writeFileSync(filename, typeof value === "string" ? value : JSON.stringify(value), { mode: 0o600 });
  return filename;
}
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("Android push client configuration", () => {
  it("preserves existing builds unless an Android QA worker requires push setup", () => {
    expect(resolveAndroidGoogleServicesFile({}, packageName)).toBeUndefined();
    expect(resolveAndroidGoogleServicesFile({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "ios", JANGO_STORE_QA: "true" }, packageName)).toBeUndefined();
    expect(() => resolveAndroidGoogleServicesFile({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android", EAS_BUILD_PROFILE: "store-qa" }, packageName)).toThrow("required");
  });
  it("accepts the matching package's client configuration", () => {
    const filename = file(clientConfig());
    expect(resolveAndroidGoogleServicesFile({ GOOGLE_SERVICES_JSON: filename }, packageName)).toBe(filename);
  });
  it("rejects another package, including a production file on a QA development ID", () => {
    expect(() => resolveAndroidGoogleServicesFile({ GOOGLE_SERVICES_JSON: file(clientConfig()) }, "com.expirymate.mobile.crayonqa")).toThrow("this Android package");
  });
  it.each([
    { type: "service_account", private_key: "PRIVATE-SERVER-KEY", client_email: "server@example.test" },
    { ...clientConfig(), private_key: "PRIVATE-SERVER-KEY" },
    { ...clientConfig(), project_info: { project_number: "other", project_id: "test-project" } },
    { ...clientConfig(), client: [] },
  ])("rejects unsafe or incomplete client configuration", value => {
    const filename = file(value);
    expect(() => resolveAndroidGoogleServicesFile({ GOOGLE_SERVICES_JSON: filename }, packageName)).toThrow("not a private server key");
  });
  it("does not echo malformed content or a pasted private key in IO errors", () => {
    for (const filename of [file("not-json PRIVATE-SERVER-KEY"), '{"private_key":"PRIVATE-SERVER-KEY"}']) {
      try { resolveAndroidGoogleServicesFile({ GOOGLE_SERVICES_JSON: filename }, packageName); throw new Error("Expected rejection"); }
      catch (error) { expect(String(error)).not.toContain("PRIVATE-SERVER-KEY"); expect(String(error)).toContain("readable Android client JSON"); }
    }
  });
});
