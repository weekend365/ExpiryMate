import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const backgrounds = [
  ["Home", "home-welcome"],
  ["Inventory", "fridge-interior"],
  ["Recommendations", "kitchen-cooking"],
  ["Shopping", "shopping-preparation"],
].map(([name, stem]) => {
  const record = JSON.parse(fs.readFileSync(
    new URL(`../../../design/backgrounds/${stem}-crayon-v1.json`, import.meta.url),
    "utf8",
  ));
  if (!/^[a-f0-9]{64}$/.test(record.sha256)) {
    throw new Error(`${name} source requires a SHA-256 provenance record.`);
  }
  return { name, source: record.source, destination: `${stem}-bg.png`, sourceHash: record.sha256 };
});

// Validate all sources before writing any runtime asset.
const assets = backgrounds.map((background) => {
  const source = new URL(`../../../design/backgrounds/${background.source}`, import.meta.url);
  const destination = fileURLToPath(new URL(`../assets/backgrounds/${background.destination}`, import.meta.url));
  const original = fs.readFileSync(source);
  if (createHash("sha256").update(original).digest("hex") !== background.sourceHash) {
    throw new Error(`${background.name} source differs from its recorded artwork.`);
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
