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

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
    ios: {
      ...appJson.expo.ios,
      ...(personalTeam ? personalTeamIosCapabilities : paidTeamIosCapabilities),
    },
  },
};
