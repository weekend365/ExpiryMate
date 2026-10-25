const fs = require("node:fs");
const path = require("node:path");

/** GOOGLE_SERVICES_JSON is a client-config file path, never a service-account key. */
function resolveAndroidGoogleServicesFile(env = process.env, packageName) {
  const file = env.GOOGLE_SERVICES_JSON?.trim();
  const required = env.EAS_BUILD === "true" && env.EAS_BUILD_PLATFORM === "android"
    && (env.JANGO_STORE_QA === "true" || env.EAS_BUILD_PROFILE === "store-qa");
  if (!file) {
    if (required) throw new Error("GOOGLE_SERVICES_JSON is required for Android store QA push verification.");
    return undefined;
  }
  const filename = path.resolve(__dirname, "..", file);
  let config;
  try {
    if (fs.statSync(filename).size > 256 * 1024) throw new Error("Oversized config");
    config = JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch {
    // fs errors may embed the supplied value, including an accidentally pasted key.
    throw new Error("GOOGLE_SERVICES_JSON must point to a readable Android client JSON file.");
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("GOOGLE_SERVICES_JSON must be Android client configuration.");
  }
  const client = Array.isArray(config.client)
    ? config.client.find(item => item?.client_info?.android_client_info?.package_name === packageName) : undefined;
  const number = config.project_info?.project_number;
  const appId = client?.client_info?.mobilesdk_app_id;
  if (config.type === "service_account" || config.private_key || config.client_email
    || typeof number !== "string" || !/^\d+$/.test(number)
    || typeof config.project_info?.project_id !== "string" || !config.project_info.project_id.trim()
    || typeof appId !== "string" || !appId.startsWith(`1:${number}:android:`)
    || !Array.isArray(client?.api_key)
    || !client.api_key.some(key => typeof key?.current_key === "string" && key.current_key.trim())) {
    throw new Error("GOOGLE_SERVICES_JSON must be client configuration for this Android package, not a private server key.");
  }
  return filename;
}

module.exports = { resolveAndroidGoogleServicesFile };
