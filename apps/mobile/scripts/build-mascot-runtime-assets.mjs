#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  deriveSmallMaster,
  fullAssetPath,
  mascotMoods,
} from "./derive-mascot-small-assets.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const charactersDir = path.resolve(scriptDir, "../assets/characters");
const runtimeDir = path.join(charactersDir, "runtime");

const moods = mascotMoods;

const variants = [
  {
    name: "full",
    logicalSize: 160,
    sourcePath: fullAssetPath,
  },
  {
    name: "small",
    logicalSize: 72,
    sourcePath: fullAssetPath,
    transform: deriveSmallMaster,
  },
];

const densities = [
  { suffix: "", scale: 1 },
  { suffix: "@2x", scale: 2 },
  { suffix: "@3x", scale: 3 },
];

function overlap(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

export function resizePremultiplied(source, width, height) {
  const output = new PNG({ width, height, colorType: 6 });
  const scaleX = source.width / width;
  const scaleY = source.height / height;

  for (let outputY = 0; outputY < height; outputY += 1) {
    const sourceY0 = outputY * scaleY;
    const sourceY1 = (outputY + 1) * scaleY;
    const firstSourceY = Math.floor(sourceY0);
    const lastSourceY = Math.min(source.height, Math.ceil(sourceY1));

    for (let outputX = 0; outputX < width; outputX += 1) {
      const sourceX0 = outputX * scaleX;
      const sourceX1 = (outputX + 1) * scaleX;
      const firstSourceX = Math.floor(sourceX0);
      const lastSourceX = Math.min(source.width, Math.ceil(sourceX1));
      const sampleArea = (sourceX1 - sourceX0) * (sourceY1 - sourceY0);
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;

      for (let sourceY = firstSourceY; sourceY < lastSourceY; sourceY += 1) {
        const yWeight = overlap(sourceY0, sourceY1, sourceY, sourceY + 1);

        for (
          let sourceX = firstSourceX;
          sourceX < lastSourceX;
          sourceX += 1
        ) {
          const xWeight = overlap(sourceX0, sourceX1, sourceX, sourceX + 1);
          const weight = xWeight * yWeight;
          const sourceIndex = (sourceY * source.width + sourceX) * 4;
          const alpha = source.data[sourceIndex + 3] / 255;
          const alphaWeight = alpha * weight;

          alphaSum += alphaWeight;
          redSum += source.data[sourceIndex] * alphaWeight;
          greenSum += source.data[sourceIndex + 1] * alphaWeight;
          blueSum += source.data[sourceIndex + 2] * alphaWeight;
        }
      }

      const outputIndex = (outputY * width + outputX) * 4;
      const outputAlpha = alphaSum / sampleArea;
      output.data[outputIndex + 3] = Math.round(outputAlpha * 255);

      if (alphaSum > 0) {
        output.data[outputIndex] = Math.round(redSum / alphaSum);
        output.data[outputIndex + 1] = Math.round(greenSum / alphaSum);
        output.data[outputIndex + 2] = Math.round(blueSum / alphaSum);
      }
    }
  }

  return output;
}

function assertSource(source, sourcePath) {
  if (source.width !== 1024 || source.height !== 1024) {
    throw new Error(
      `${sourcePath} must be a 1024x1024 source master, got ${source.width}x${source.height}`,
    );
  }

  const cornerIndexes = [
    3,
    (source.width - 1) * 4 + 3,
    (source.height - 1) * source.width * 4 + 3,
    (source.height * source.width - 1) * 4 + 3,
  ];

  if (cornerIndexes.some((index) => source.data[index] !== 0)) {
    throw new Error(`${sourcePath} must have transparent canvas corners`);
  }
}

function writePng(outputPath, png) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    PNG.sync.write(png, {
      colorType: 6,
      inputColorType: 6,
      inputHasAlpha: true,
    }),
  );
}

export function buildRuntimeAssets() {
  let outputBytes = 0;

  fs.rmSync(runtimeDir, { recursive: true, force: true });

  for (const variant of variants) {
    for (const mood of moods) {
      const sourcePath = variant.sourcePath(mood);
      const fullMaster = PNG.sync.read(fs.readFileSync(sourcePath));
      assertSource(fullMaster, sourcePath);
      const source = variant.transform
        ? variant.transform(fullMaster)
        : fullMaster;
      assertSource(source, `${sourcePath} (${variant.name})`);

      for (const density of densities) {
        const size = variant.logicalSize * density.scale;
        const outputPath = path.join(
          runtimeDir,
          variant.name,
          `jango-${mood}${density.suffix}.png`,
        );
        const output = resizePremultiplied(source, size, size);
        writePng(outputPath, output);
        outputBytes += fs.statSync(outputPath).size;
      }
    }
  }

  console.log(
    `built ${moods.length * variants.length * densities.length} mascot runtime assets (${(outputBytes / 1024 / 1024).toFixed(2)} MB)`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) buildRuntimeAssets();
