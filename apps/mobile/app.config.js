const appJson = require("./app.json");
const { validateExpoPublicEnv } = require("./scripts/validate-public-env.cjs");

validateExpoPublicEnv();

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
});
