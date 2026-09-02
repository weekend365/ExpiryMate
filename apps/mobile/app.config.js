const appJson = require("./app.json");
const { validateExpoPublicEnv } = require("./scripts/validate-public-env.cjs");
const {
  assertIosTeamCompatibleWithAppEnv,
  isPersonalTeamBuild,
} = require("./scripts/ios-team-env.cjs");

// Personal Team must not strip Apple/Push on preview/production profiles.
assertIosTeamCompatibleWithAppEnv(process.env);

// Full public-env checks run on EAS Build workers (and eas-build-post-install).
// Local `eas credentials` / `expo config` with the production profile must not
// require EAS cloud secrets to be present in the shell.
if (process.env.EAS_BUILD === "true") {
  validateExpoPublicEnv(process.env);
}

const sentryPluginNames = new Set(["@sentry/react-native", "@sentry/react-native/expo"]);

/** Personal Team (free Apple ID) cannot use Push Notifications or Sign in with Apple. */
const personalTeamPluginNames = new Set([
  "expo-notifications",
  "expo-apple-authentication",
]);
const personalTeam = isPersonalTeamBuild(process.env);
const isProduction = process.env.EXPO_PUBLIC_APP_ENV === "production";
const buildGitSha =
  process.env.EXPO_PUBLIC_GIT_SHA?.trim() ||
  process.env.EAS_BUILD_GIT_COMMIT_HASH?.trim() ||
  "unknown";
const googleTestAppIds = {
  ios: "ca-app-pub-3940256099942544~1458002511",
  android: "ca-app-pub-3940256099942544~3347511713",
};
const googleMobileAdsPlugin = (() => {
  try {
    require.resolve("react-native-google-mobile-ads/app.plugin.js");
    return "react-native-google-mobile-ads";
  } catch {
    // Some pnpm stores can retain the compiled plugin while losing the tiny
    // package-root proxy. Point Expo at the same official implementation.
    return "react-native-google-mobile-ads/plugin/build";
  }
})();

const plugins = appJson.expo.plugins.filter((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;

  if (sentryPluginNames.has(pluginName)) {
    return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());
  }

  if (personalTeam && personalTeamPluginNames.has(pluginName)) {
    return false;
  }

  return true;
});

plugins.push("expo-iap");
plugins.push([
  googleMobileAdsPlugin,
  {
    iosAppId:
      (isProduction && process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim()) ||
      googleTestAppIds.ios,
    androidAppId:
      (isProduction && process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim()) ||
      googleTestAppIds.android,
    delayAppMeasurementInit: true,
    optimizeInitialization: true,
    optimizeAdLoading: true,
  },
]);

const paidTeamIosCapabilities = {
  usesAppleSignIn: true,
  entitlements: {
    "com.apple.developer.applesignin": ["Default"],
    // Xcode/EAS release archives rewrite this to production when signing for App Store.
    "aps-environment": "development",
  },
};

const personalTeamIosCapabilities = {
  usesAppleSignIn: false,
  entitlements: {},
};

/** @type {(context: import('expo/config').ConfigContext) => import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  plugins,
  ios: {
    ...config.ios,
    ...(personalTeam ? personalTeamIosCapabilities : paidTeamIosCapabilities),
  },
  extra: {
    ...config.extra,
    build: {
      gitSha: buildGitSha,
    },
  },
});
