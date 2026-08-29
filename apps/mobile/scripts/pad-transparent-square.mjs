#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { PNG } from "pngjs";

const [, , inputPath, outputPath, sizeArg = "1024"] = process.argv;
const size = Number.parseInt(sizeArg, 10);

if (!inputPath || !outputPath || !Number.isInteger(size) || size <= 0) {
  console.error(
    "Usage: node scripts/pad-transparent-square.mjs <input.png> <output.png> [size]",
  );
  process.exit(1);
}

const source = PNG.sync.read(fs.readFileSync(inputPath));
if (source.width > size || source.height > size) {
  throw new Error(
    `Source ${source.width}x${source.height} exceeds ${size}x${size}; resize it first`,
  );
}

const output = new PNG({ width: size, height: size, colorType: 6 });
output.data.fill(0);

const offsetX = Math.floor((size - source.width) / 2);
const offsetY = Math.floor((size - source.height) / 2);

for (let y = 0; y < source.height; y += 1) {
  const sourceStart = y * source.width * 4;
  const sourceEnd = sourceStart + source.width * 4;
  const outputStart = ((y + offsetY) * size + offsetX) * 4;
  source.data.copy(output.data, outputStart, sourceStart, sourceEnd);
}

fs.writeFileSync(
  outputPath,
  PNG.sync.write(output, {
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
  }),
);

console.log(
  `padded ${source.width}x${source.height} to ${size}x${size} at ${offsetX},${offsetY}`,
);
