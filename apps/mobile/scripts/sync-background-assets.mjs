import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const homeRecord = JSON.parse(fs.readFileSync(
  new URL("../../../design/backgrounds/home-welcome-crayon-v1.json", import.meta.url),
  "utf8",
));
const backgrounds = [
  {
    name: "Shopping",
    source: "shopping-preparation-v1.png",
    destination: "shopping-preparation-bg.png",
  },
  {
    name: "Home",
    source: homeRecord.source,
    destination: "home-welcome-bg.png",
    acceptedHash: homeRecord.sha256,
  },
];

// Validate all sources before writing any runtime asset.
const assets = backgrounds.map((background) => {
  const source = new URL(`../../../design/backgrounds/${background.source}`, import.meta.url);
  const destination = fileURLToPath(new URL(`../assets/backgrounds/${background.destination}`, import.meta.url));
  const original = fs.readFileSync(source);
  if (background.acceptedHash && createHash("sha256").update(original).digest("hex") !== background.acceptedHash) {
    throw new Error(`${background.name} source differs from its accepted artwork.`);
  }
  return { ...background, destination, original };
});

for (const { name, destination, original } of assets) {
  const matches = fs.existsSync(destination) && original.equals(fs.readFileSync(destination));
  if (process.argv.includes("--check")) {
    if (!matches) {
      throw new Error(`${name} background is out of sync. Run backgrounds:sync.`);
    }
    console.log(`${name} background matches its source artwork.`);
  } else {
    if (!matches) fs.writeFileSync(destination, original);
    console.log(`Synced ${name.toLowerCase()} background from its source artwork.`);
  }
}
