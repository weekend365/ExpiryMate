import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const charactersDir = path.resolve(scriptDir, "../assets/characters");
const moods = [
  "idle",
  "happy",
  "worry",
  "cooking",
  "empty",
  "speak",
  "think",
  "point",
];
const variants = [
  { name: "full", logicalSize: 160 },
  { name: "small", logicalSize: 72 },
];
const densities = [
  { suffix: "", scale: 1 },
  { suffix: "@2x", scale: 2 },
  { suffix: "@3x", scale: 3 },
];

function cornerAlphas(png) {
  return [
    png.data[3],
    png.data[(png.width - 1) * 4 + 3],
    png.data[(png.height - 1) * png.width * 4 + 3],
    png.data[(png.height * png.width - 1) * 4 + 3],
  ];
}

describe("mascot runtime assets", () => {
  it("provides valid RGBA images for every mood and display density", () => {
    let runtimeBytes = 0;
    const runtimeAssetCount = variants.reduce((total, variant) => {
      const variantDir = path.join(charactersDir, "runtime", variant.name);
      return (
        total +
        fs.readdirSync(variantDir).filter((fileName) => fileName.endsWith(".png"))
          .length
      );
    }, 0);

    expect(runtimeAssetCount).toBe(
      moods.length * variants.length * densities.length,
    );

    for (const variant of variants) {
      for (const mood of moods) {
        for (const density of densities) {
          const size = variant.logicalSize * density.scale;
          const assetPath = path.join(
            charactersDir,
            "runtime",
            variant.name,
            `jango-${mood}${density.suffix}.png`,
          );
          const file = fs.readFileSync(assetPath);
          const png = PNG.sync.read(file);
          let hasSoftAlpha = false;

          for (let index = 3; index < png.data.length; index += 4) {
            if (png.data[index] > 0 && png.data[index] < 255) {
              hasSoftAlpha = true;
              break;
            }
          }

          runtimeBytes += file.length;
          expect([png.width, png.height], assetPath).toEqual([size, size]);
          expect(png.alpha, assetPath).toBe(true);
          expect(cornerAlphas(png), assetPath).toEqual([0, 0, 0, 0]);
          expect(hasSoftAlpha, assetPath).toBe(true);
        }
      }
    }

    const sourceBytes = moods.reduce((total, mood) => {
      return (
        total +
        fs.statSync(path.join(charactersDir, `jango-${mood}.png`)).size +
        fs.statSync(
          path.join(charactersDir, "small", `jango-${mood}-small.png`),
        ).size
      );
    }, 0);

    expect(runtimeBytes).toBeLessThan(sourceBytes);
  });
});
