const path = require("node:path");
const { compileModsAsync } = require("expo/config-plugins");
const withVariants = require("../plugins/with-ios-app-variants");

async function syncIosAppVariants() {
  await compileModsAsync(withVariants(JSON.parse(JSON.stringify(require("../app.json").expo))), {
    projectRoot: path.resolve(__dirname, ".."), platforms: ["ios"],
  });
}
if (require.main === module) syncIosAppVariants().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { syncIosAppVariants };
