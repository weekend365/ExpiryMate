const { withAppBuildGradle } = require("expo/config-plugins");

// SDK 54's template uses proguard-android.txt, which disables optimization even
// when minification is enabled. Apply this through Prebuild, never generated files.
function enableOptimizedProguard(contents) {
  const legacy = /getDefaultProguardFile\((["'])proguard-android\.txt\1\)/g;
  const updated = contents.replace(
    legacy,
    'getDefaultProguardFile("proguard-android-optimize.txt")',
  );
  if (!/getDefaultProguardFile\((["'])proguard-android-optimize\.txt\1\)/.test(updated)) {
    throw new Error("Android release optimization: default ProGuard configuration not found. Review the Expo template.");
  }
  return updated;
}

module.exports = function withAndroidReleaseOptimization(config) {
  return withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = enableOptimizedProguard(modConfig.modResults.contents);
    return modConfig;
  });
};
module.exports.enableOptimizedProguard = enableOptimizedProguard;
