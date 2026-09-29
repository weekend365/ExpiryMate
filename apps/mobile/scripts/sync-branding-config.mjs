import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { semanticColors } from "@expirymate/shared";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "app.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.expo.backgroundColor = semanticColors.background;
config.expo.primaryColor = semanticColors.brandAccent;
config.expo.android.adaptiveIcon.backgroundColor = semanticColors.background;
for (const plugin of config.expo.plugins) {
  if (!Array.isArray(plugin)) continue;
  if (plugin[0] === "expo-notifications") plugin[1].color = semanticColors.brandAccent;
  if (plugin[0] === "expo-splash-screen") plugin[1].backgroundColor = semanticColors.background;
}
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
// The tracked native iOS splash color must match before Prebuild or an archive.
const colorPath = path.join(root, "ios/ExpiryMate/Images.xcassets/SplashScreenBackground.colorset/Contents.json");
if (fs.existsSync(colorPath)) {
  const contents = JSON.parse(fs.readFileSync(colorPath, "utf8"));
  const [red, green, blue] = semanticColors.background.slice(1).match(/.{2}/g);
  for (const color of contents.colors) color.color.components = {
    alpha: "1.000",
    blue: (parseInt(blue, 16) / 255).toFixed(15),
    green: (parseInt(green, 16) / 255).toFixed(15),
    red: (parseInt(red, 16) / 255).toFixed(15),
  };
  fs.writeFileSync(colorPath, `${JSON.stringify(contents, null, 2)}\n`);
}
console.log("Synced Expo and native splash colors from shared tokens");
