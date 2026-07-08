const appJson = require("./app.json");

const sentryPluginNames = new Set(["@sentry/react-native", "@sentry/react-native/expo"]);

/** Personal Team (free Apple ID) cannot use Push Notifications or Sign in with Apple. */
const personalTeamPluginNames = new Set(["expo-notifications", "expo-apple-authentication"]);
const isPersonalTeamBuild = process.env.EXPO_IOS_PERSONAL_TEAM === "1";

const plugins = appJson.expo.plugins.filter((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;

  if (sentryPluginNames.has(pluginName)) {
    return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());
  }

  if (isPersonalTeamBuild && personalTeamPluginNames.has(pluginName)) {
    return false;
  }

  return true;
});

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...appJson.expo,
    plugins,
  },
};
