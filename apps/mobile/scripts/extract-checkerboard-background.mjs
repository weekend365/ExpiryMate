#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { PNG } from "pngjs";

const [, , inputPath, outputPath, sizeArg = "1024"] = process.argv;
const outputSize = Number.parseInt(sizeArg, 10);

if (
  !inputPath ||
  !outputPath ||
  !Number.isInteger(outputSize) ||
  outputSize <= 0
) {
  console.error(
    "Usage: node scripts/extract-checkerboard-background.mjs <input.png> <output.png> [size]",
  );
  process.exit(1);
}

function isCheckerboardPixel(png, pixelIndex) {
  const dataIndex = pixelIndex * 4;
  const red = png.data[dataIndex];
  const green = png.data[dataIndex + 1];
  const blue = png.data[dataIndex + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);

  // Image generators may bake transparent-preview tiles anywhere from near
  // white to light gray, with small RGB noise at tile boundaries. Flood-fill
  // only neutral pixels connected to the canvas edge so the character's warm
  // white enclosed areas remain intact.
  return minimum >= 220 && maximum - minimum <= 16;
}

function removeConnectedCheckerboard(source) {
  const pixelCount = source.width * source.height;
  const exterior = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  function enqueue(pixelIndex) {
    if (
      exterior[pixelIndex] === 0 &&
      isCheckerboardPixel(source, pixelIndex)
    ) {
      exterior[pixelIndex] = 1;
      queue[queueEnd] = pixelIndex;
      queueEnd += 1;
    }
  }

  for (let x = 0; x < source.width; x += 1) {
    enqueue(x);
    enqueue((source.height - 1) * source.width + x);
  }

  for (let y = 0; y < source.height; y += 1) {
    enqueue(y * source.width);
    enqueue(y * source.width + source.width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;
    const x = pixelIndex % source.width;
    const y = Math.floor(pixelIndex / source.width);

    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < source.width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - source.width);
    if (y + 1 < source.height) enqueue(pixelIndex + source.width);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (exterior[pixelIndex] === 1) {
      const dataIndex = pixelIndex * 4;
      source.data[dataIndex] = 0;
      source.data[dataIndex + 1] = 0;
      source.data[dataIndex + 2] = 0;
      source.data[dataIndex + 3] = 0;
    }
  }

  return queueEnd;
}

function overlap(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function resizePremultiplied(source, width, height) {
  const output = new PNG({ width, height, colorType: 6 });
  const scaleX = source.width / width;
  const scaleY = source.height / height;

  for (let outputY = 0; outputY < height; outputY += 1) {
    const sourceY0 = outputY * scaleY;
    const sourceY1 = (outputY + 1) * scaleY;

    for (let outputX = 0; outputX < width; outputX += 1) {
      const sourceX0 = outputX * scaleX;
      const sourceX1 = (outputX + 1) * scaleX;
      const sampleArea = (sourceX1 - sourceX0) * (sourceY1 - sourceY0);
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;

      for (
        let sourceY = Math.floor(sourceY0);
        sourceY < Math.min(source.height, Math.ceil(sourceY1));
        sourceY += 1
      ) {
        const yWeight = overlap(sourceY0, sourceY1, sourceY, sourceY + 1);

        for (
          let sourceX = Math.floor(sourceX0);
          sourceX < Math.min(source.width, Math.ceil(sourceX1));
          sourceX += 1
        ) {
          const xWeight = overlap(sourceX0, sourceX1, sourceX, sourceX + 1);
          const weight = xWeight * yWeight;
          const sourceIndex = (sourceY * source.width + sourceX) * 4;
          const alphaWeight = (source.data[sourceIndex + 3] / 255) * weight;

          alphaSum += alphaWeight;
          redSum += source.data[sourceIndex] * alphaWeight;
          greenSum += source.data[sourceIndex + 1] * alphaWeight;
          blueSum += source.data[sourceIndex + 2] * alphaWeight;
        }
      }

      const outputIndex = (outputY * width + outputX) * 4;
      output.data[outputIndex + 3] = Math.round((alphaSum / sampleArea) * 255);

      if (alphaSum > 0) {
        output.data[outputIndex] = Math.round(redSum / alphaSum);
        output.data[outputIndex + 1] = Math.round(greenSum / alphaSum);
        output.data[outputIndex + 2] = Math.round(blueSum / alphaSum);
      }
    }
  }

  return output;
}

const source = PNG.sync.read(fs.readFileSync(inputPath));
const removedPixelCount = removeConnectedCheckerboard(source);
const output =
  source.width === outputSize && source.height === outputSize
    ? source
    : resizePremultiplied(source, outputSize, outputSize);

fs.writeFileSync(
  outputPath,
  PNG.sync.write(output, {
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
  }),
);

console.log(
  `removed ${removedPixelCount} connected checkerboard pixels and wrote ${output.width}x${output.height}`,
);
