const appJson = require("./app.json");

const sentryPluginNames = new Set(["@sentry/react-native", "@sentry/react-native/expo"]);

const plugins = appJson.expo.plugins.filter((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;

  if (sentryPluginNames.has(pluginName)) {
    return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());
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
