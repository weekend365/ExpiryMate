#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const charactersDir = path.resolve(scriptDir, "../assets/characters");

export const mascotMoods = [
  "idle",
  "happy",
  "worry",
  "cooking",
  "empty",
  "speak",
  "think",
  "point",
];

// This crop is shared by every mood so the small variant cannot drift into a
// separately redesigned character. It keeps every current gesture inside the
// horizontal frame and ends at the upper apron / glove area.
export const smallMasterCrop = Object.freeze({
  x: 97,
  y: 0,
  size: 830,
  outputSize: 1024,
});

function samplePremultipliedBilinear(source, sourceX, sourceY) {
  const x0 = Math.max(0, Math.floor(sourceX));
  const y0 = Math.max(0, Math.floor(sourceY));
  const x1 = Math.min(source.width - 1, x0 + 1);
  const y1 = Math.min(source.height - 1, y0 + 1);
  const xWeight = sourceX - Math.floor(sourceX);
  const yWeight = sourceY - Math.floor(sourceY);
  const samples = [
    [x0, y0, (1 - xWeight) * (1 - yWeight)],
    [x1, y0, xWeight * (1 - yWeight)],
    [x0, y1, (1 - xWeight) * yWeight],
    [x1, y1, xWeight * yWeight],
  ];
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const [x, y, weight] of samples) {
    const index = (y * source.width + x) * 4;
    const sampleAlpha = source.data[index + 3] / 255;
    const alphaWeight = sampleAlpha * weight;
    alpha += alphaWeight;
    red += source.data[index] * alphaWeight;
    green += source.data[index + 1] * alphaWeight;
    blue += source.data[index + 2] * alphaWeight;
  }

  if (alpha === 0) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

export function deriveSmallMaster(source) {
  if (source.width !== 1024 || source.height !== 1024) {
    throw new Error(
      `Full mascot master must be 1024x1024, got ${source.width}x${source.height}`,
    );
  }

  const { x, y, size, outputSize } = smallMasterCrop;
  const output = new PNG({ width: outputSize, height: outputSize, colorType: 6 });
  const scale = size / outputSize;

  for (let outputY = 0; outputY < outputSize; outputY += 1) {
    const sourceY = y + (outputY + 0.5) * scale - 0.5;

    for (let outputX = 0; outputX < outputSize; outputX += 1) {
      const sourceX = x + (outputX + 0.5) * scale - 0.5;
      const outputIndex = (outputY * outputSize + outputX) * 4;
      const color = samplePremultipliedBilinear(source, sourceX, sourceY);
      output.data.set(color, outputIndex);
    }
  }

  return output;
}

export function fullAssetPath(mood) {
  return path.join(charactersDir, `jango-${mood}.png`);
}

export function smallAssetPath(mood) {
  return path.join(charactersDir, "small", `jango-${mood}-small.png`);
}

export function writeSmallMasters() {
  fs.mkdirSync(path.join(charactersDir, "small"), { recursive: true });

  for (const mood of mascotMoods) {
    const source = PNG.sync.read(fs.readFileSync(fullAssetPath(mood)));
    const output = deriveSmallMaster(source);
    fs.writeFileSync(
      smallAssetPath(mood),
      PNG.sync.write(output, {
        colorType: 6,
        inputColorType: 6,
        inputHasAlpha: true,
      }),
    );
    console.log(`derived small mascot from full master: ${mood}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) writeSmallMasters();
