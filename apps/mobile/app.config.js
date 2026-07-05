const appJson = require("./app.json");

const plugins = appJson.expo.plugins.filter((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === "@sentry/react-native/expo") {
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
