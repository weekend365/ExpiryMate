import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { PNG } = createRequire(import.meta.url)("pngjs");

const backgrounds = [
  ["Home", "home-welcome"],
  ["Inventory", "fridge-interior"],
  ["Recommendations", "kitchen-cooking"],
  ["Shopping", "shopping-preparation"],
  ["Login", "login-welcome"],
  ["Welcome room", "welcome-room", "v2"],
  ["Ingredient preparation", "ingredient-prep", "v2"],
  ["Cooking workspace", "cooking-workspace", "v2"],
  ["Settings study", "settings-study", "v2"],
  ["Insights journal", "insights-journal", "v2"],
  ["Shared table", "shared-table", "v2"],
].map(([name, stem, version = "v1"]) => {
  const record = JSON.parse(fs.readFileSync(
    new URL(`../../../design/backgrounds/${stem}-crayon-${version}.json`, import.meta.url),
    "utf8",
  ));
  if (!/^[a-f0-9]{64}$/.test(record.sha256)) {
    throw new Error(`${name} source requires a SHA-256 provenance record.`);
  }
  if (record.promptSha256) {
    const prompt = fs.readFileSync(new URL(`../../../design/backgrounds/${record.prompt}`, import.meta.url));
    if (createHash("sha256").update(prompt).digest("hex") !== record.promptSha256) {
      throw new Error(`${name} generation prompt differs from its provenance record.`);
    }
  }
  for (const reference of [...(record.styleReferences ?? []), ...(record.generationInputs ?? [])]) {
    const bytes = fs.readFileSync(new URL(`../../../${reference.file}`, import.meta.url));
    if (createHash("sha256").update(bytes).digest("hex") !== reference.sha256) {
      throw new Error(`${name} generation reference differs from its provenance record.`);
    }
    if (reference.prompt) {
      const prompt = fs.readFileSync(new URL(`../../../${reference.prompt}`, import.meta.url));
      if (createHash("sha256").update(prompt).digest("hex") !== reference.promptSha256) {
        throw new Error(`${name} input generation prompt differs from its provenance record.`);
      }
    }
  }
  if (record.previousArtwork && typeof record.previousArtwork === "object") {
    const bytes = fs.readFileSync(new URL(`../../../${record.previousArtwork.file}`, import.meta.url));
    if (createHash("sha256").update(bytes).digest("hex") !== record.previousArtwork.sha256) {
      throw new Error(`${name} previous artwork differs from its provenance record.`);
    }
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
  const png = PNG.sync.read(original);
  if (png.width !== 1024 || png.height !== 1536) {
    throw new Error(`${background.name} background must be a native 1024×1536 PNG.`);
  }
  for (let index = 3; index < png.data.length; index += 4) {
    if (png.data[index] !== 255) {
      throw new Error(`${background.name} background must be fully opaque.`);
    }
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
