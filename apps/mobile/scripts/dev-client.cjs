const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { syncIosAppVariants } = require("./sync-ios-app-variants.cjs");
const { QA } = require("./app-variant.cjs");

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!["ios", "start"].includes(command)) throw new Error("Expected ios or start");
  process.env.APP_VARIANT = "development";
  process.env.EXPO_PUBLIC_APP_ENV = "development";
  process.env.NODE_ENV = "development";
  if (command === "ios") {
    const root = path.resolve(__dirname, "..");
    require(require.resolve("@expo/env", { paths: [require.resolve("expo/package.json")] })).load(root);
    await syncIosAppVariants();
    require("./ios-device.cjs").runIosDevice(root, args);
    return;
  }
  const expoArgs = ["start", "--dev-client", "--tunnel", "--scheme", QA.scheme];
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../node_modules/expo/bin/cli"), ...expoArgs, ...args], {
    cwd: path.resolve(__dirname, ".."), env: process.env, stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
