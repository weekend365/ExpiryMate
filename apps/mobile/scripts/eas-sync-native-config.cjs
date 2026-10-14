const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const reviewedBrandingFiles = [
  "AppIcon.appiconset/App-Icon-1024x1024@1x.png",
  "SplashScreenLogo.imageset/image.png",
  "SplashScreenLogo.imageset/image@2x.png",
  "SplashScreenLogo.imageset/image@3x.png",
];

function syncNativeConfigOnEas(env = process.env, options = {}) {
  if (env.EAS_BUILD !== "true" || env.EAS_BUILD_PLATFORM !== "ios") {
    return { skipped: true };
  }

  const mobileRoot = options.mobileRoot || path.resolve(__dirname, "..");
  // branding:sync produces reviewed native derivatives from the character
  // masters. Expo uses a different resampler; retain those exact derivatives
  // while still regenerating version, capabilities and other native config.
  const brandingRoot = path.join(mobileRoot, "ios/ExpiryMate/Images.xcassets");
  const branding = reviewedBrandingFiles.map(relative => {
    const filename = path.join(brandingRoot, relative);
    return { filename, bytes: fs.readFileSync(filename) };
  });
  const expoCli = path.join(mobileRoot, "node_modules", "expo", "bin", "cli");
  const result = (options.spawn || spawnSync)(
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
  for (const asset of branding) fs.writeFileSync(asset.filename, asset.bytes);
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

module.exports = { syncNativeConfigOnEas, reviewedBrandingFiles };
