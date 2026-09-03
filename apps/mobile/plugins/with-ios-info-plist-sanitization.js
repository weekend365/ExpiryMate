const { withInfoPlist } = require("expo/config-plugins");

function removeMacOSMinimumSystemVersion(infoPlist) {
  delete infoPlist.LSMinimumSystemVersion;
  return infoPlist;
}

/**
 * iOS gets its MinimumOSVersion from IPHONEOS_DEPLOYMENT_TARGET at build time.
 * LSMinimumSystemVersion is a macOS key and App Store validation rejects an iOS
 * deployment target (for example 16.4) when it is copied into that key.
 */
function withIosInfoPlistSanitization(config) {
  return withInfoPlist(config, (modConfig) => {
    removeMacOSMinimumSystemVersion(modConfig.modResults);
    return modConfig;
  });
}

module.exports = withIosInfoPlistSanitization;
module.exports.removeMacOSMinimumSystemVersion = removeMacOSMinimumSystemVersion;
