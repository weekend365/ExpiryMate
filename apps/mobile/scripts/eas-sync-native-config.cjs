const path = require("node:path");
const { spawnSync } = require("node:child_process");

function syncNativeConfigOnEas(env = process.env) {
  if (env.EAS_BUILD !== "true" || env.EAS_BUILD_PLATFORM !== "ios") {
    return { skipped: true };
  }

  const mobileRoot = path.resolve(__dirname, "..");
  const expoCli = path.join(mobileRoot, "node_modules", "expo", "bin", "cli");
  const result = spawnSync(
    process.execPath,
    [expoCli, "prebuild", "--platform", "ios", "--no-install"],
    {
      cwd: mobileRoot,
      env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Expo iOS config sync failed with exit code ${result.status}.`);
  }
  return { skipped: false };
}

if (require.main === module) {
  try {
    const result = syncNativeConfigOnEas();
    console.log(
      result.skipped
        ? "Skipped native config sync outside an iOS EAS worker."
        : "Synchronized iOS native config from Expo app config.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { syncNativeConfigOnEas };
