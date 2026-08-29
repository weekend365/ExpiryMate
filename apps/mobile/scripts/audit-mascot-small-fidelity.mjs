#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  deriveSmallMaster,
  fullAssetPath,
  mascotMoods,
  smallMasterCrop,
} from "./derive-mascot-small-assets.mjs";
import { resizePremultiplied } from "./build-mascot-runtime-assets.mjs";

const shouldCheck = process.argv.includes("--check");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const charactersDir = path.resolve(scriptDir, "../assets/characters");

function isCharcoal(red, green, blue, alpha) {
  return alpha >= 128 && red <= 80 && green <= 85 && blue <= 90;
}

function isMint(red, green, blue, alpha) {
  return (
    alpha >= 128 &&
    green >= 110 &&
    green >= red + 25 &&
    green >= blue + 15 &&
    red <= 160
  );
}

function compareSmallMaster(actual, expected) {
  let alphaMismatch = 0;
  let outlineMismatch = 0;
  let mintMismatch = 0;
  let pixelMismatch = 0;
  let comparedOutlinePixels = 0;
  let comparedMintPixels = 0;

  for (let index = 0; index < actual.data.length; index += 4) {
    const actualPixel = actual.data.subarray(index, index + 4);
    const expectedPixel = expected.data.subarray(index, index + 4);
    const differs = actualPixel.some(
      (channel, channelIndex) => channel !== expectedPixel[channelIndex],
    );

    if (differs) pixelMismatch += 1;
    if (actualPixel[3] !== expectedPixel[3]) alphaMismatch += 1;

    const outlinePixel =
      isCharcoal(...actualPixel) || isCharcoal(...expectedPixel);
    if (outlinePixel) {
      comparedOutlinePixels += 1;
      if (differs) outlineMismatch += 1;
    }

    const mintPixel = isMint(...actualPixel) || isMint(...expectedPixel);
    if (mintPixel) {
      comparedMintPixels += 1;
      if (differs) mintMismatch += 1;
    }
  }

  return {
    alphaMismatch,
    outlineMismatch,
    mintMismatch,
    pixelMismatch,
    comparedOutlinePixels,
    comparedMintPixels,
  };
}

let failureCount = 0;
console.log(
  `small fidelity (crop ${smallMasterCrop.x},${smallMasterCrop.y} ${smallMasterCrop.size}x${smallMasterCrop.size} -> ${smallMasterCrop.outputSize}px)`,
);

for (const mood of mascotMoods) {
  const full = PNG.sync.read(fs.readFileSync(fullAssetPath(mood)));
  const actual = PNG.sync.read(
    fs.readFileSync(
      path.join(charactersDir, "runtime/small", `jango-${mood}@3x.png`),
    ),
  );
  const expected = resizePremultiplied(deriveSmallMaster(full), 216, 216);
  const result = compareSmallMaster(actual, expected);
  const passed =
    actual.width === expected.width &&
    actual.height === expected.height &&
    result.pixelMismatch === 0;

  if (!passed) failureCount += 1;
  console.log(
    `${passed ? "PASS" : "FAIL"} ${mood.padEnd(7)} ` +
      `outline ${result.outlineMismatch}/${result.comparedOutlinePixels} ` +
      `mint ${result.mintMismatch}/${result.comparedMintPixels} ` +
      `alpha ${result.alphaMismatch} all ${result.pixelMismatch}`,
  );
}

if (shouldCheck && failureCount > 0) {
  console.error(
    `\n${failureCount} small mascot asset(s) differ from their full-master derivation`,
  );
  process.exit(1);
}
