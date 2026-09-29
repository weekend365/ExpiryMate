import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { mascotMoods, fullAssetPath, deriveSmallMaster } from "./derive-mascot-small-assets.mjs";
import { resizePremultiplied } from "./build-mascot-runtime-assets.mjs";
import { assertSamePixels, charactersDir } from "./sync-mascot-sources.mjs";
for (const mood of mascotMoods) {
  const full = PNG.sync.read(fs.readFileSync(fullAssetPath(mood)));
  const small = deriveSmallMaster(full);
  for (const [variant, source, size] of [["full", full, 160], ["small", small, 72]]) {
    for (const [suffix, density] of [["", 1], ["@2x", 2], ["@3x", 3]]) {
      const file = `jango-${mood}${suffix}.png`;
      const actual = PNG.sync.read(fs.readFileSync(path.join(charactersDir, "runtime", variant, file)));
      assertSamePixels(actual, resizePremultiplied(source, size * density, size * density), `${variant}/${file}`);
    }
  }
}
console.log("PASS all 48 runtime assets match their source transforms");
