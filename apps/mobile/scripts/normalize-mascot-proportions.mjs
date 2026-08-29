#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { PNG } from "pngjs";

const [, , inputPath, referencePath, outputPath] = process.argv;

if (!inputPath || !referencePath || !outputPath) {
  console.error(
    "Usage: node scripts/normalize-mascot-proportions.mjs <input.png> <reference.png> <output.png>",
  );
  process.exit(1);
}

function isDoorInteriorPixel(png, pixelIndex) {
  const dataIndex = pixelIndex * 4;
  const red = png.data[dataIndex];
  const green = png.data[dataIndex + 1];
  const blue = png.data[dataIndex + 2];
  const alpha = png.data[dataIndex + 3];

  return (
    alpha > 128 &&
    red > 225 &&
    green > 218 &&
    blue > 210 &&
    Math.max(red, green, blue) - Math.min(red, green, blue) < 55
  );
}

function measureDoorInterior(png) {
  const pixelCount = png.width * png.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = null;

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] === 1 || !isDoorInteriorPixel(png, start)) continue;

    let queueStart = 0;
    let queueEnd = 0;
    let area = 0;
    let minX = png.width;
    let minY = png.height;
    let maxX = -1;
    let maxY = -1;
    visited[start] = 1;
    queue[queueEnd] = start;
    queueEnd += 1;

    while (queueStart < queueEnd) {
      const pixelIndex = queue[queueStart];
      queueStart += 1;
      const x = pixelIndex % png.width;
      const y = Math.floor(pixelIndex / png.width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [];
      if (x > 0) neighbors.push(pixelIndex - 1);
      if (x + 1 < png.width) neighbors.push(pixelIndex + 1);
      if (y > 0) neighbors.push(pixelIndex - png.width);
      if (y + 1 < png.height) neighbors.push(pixelIndex + png.width);

      for (const neighbor of neighbors) {
        if (
          visited[neighbor] === 0 &&
          isDoorInteriorPixel(png, neighbor)
        ) {
          visited[neighbor] = 1;
          queue[queueEnd] = neighbor;
          queueEnd += 1;
        }
      }
    }

    if (!largest || area > largest.area) {
      largest = { area, minX, minY, maxX, maxY };
    }
  }

  if (!largest) throw new Error("Could not locate refrigerator-door interior");
  return {
    ...largest,
    width: largest.maxX - largest.minX + 1,
    height: largest.maxY - largest.minY + 1,
  };
}

function samplePremultiplied(source, sourceX, sourceY) {
  if (
    sourceX < 0 ||
    sourceY < 0 ||
    sourceX > source.width - 1 ||
    sourceY > source.height - 1
  ) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const x1 = Math.min(source.width - 1, x0 + 1);
  const y1 = Math.min(source.height - 1, y0 + 1);
  const xFraction = sourceX - x0;
  const yFraction = sourceY - y0;
  const samples = [
    [x0, y0, (1 - xFraction) * (1 - yFraction)],
    [x1, y0, xFraction * (1 - yFraction)],
    [x0, y1, (1 - xFraction) * yFraction],
    [x1, y1, xFraction * yFraction],
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

  return alpha > 0
    ? [red / alpha, green / alpha, blue / alpha, alpha * 255]
    : [0, 0, 0, 0];
}

const source = PNG.sync.read(fs.readFileSync(inputPath));
const reference = PNG.sync.read(fs.readFileSync(referencePath));

if (
  source.width !== reference.width ||
  source.height !== reference.height
) {
  throw new Error("Input and reference canvases must have identical dimensions");
}

const sourceDoor = measureDoorInterior(source);
const targetDoor = measureDoorInterior(reference);
const scaleX = targetDoor.width / sourceDoor.width;
const scaleY = targetDoor.height / sourceDoor.height;
const output = new PNG({
  width: reference.width,
  height: reference.height,
  colorType: 6,
});

for (let y = 0; y < output.height; y += 1) {
  for (let x = 0; x < output.width; x += 1) {
    const sourceX = sourceDoor.minX + (x - targetDoor.minX) / scaleX;
    const sourceY = sourceDoor.minY + (y - targetDoor.minY) / scaleY;
    const [red, green, blue, alpha] = samplePremultiplied(
      source,
      sourceX,
      sourceY,
    );
    const outputIndex = (y * output.width + x) * 4;
    output.data[outputIndex] = Math.round(red);
    output.data[outputIndex + 1] = Math.round(green);
    output.data[outputIndex + 2] = Math.round(blue);
    output.data[outputIndex + 3] = Math.round(alpha);
  }
}

fs.writeFileSync(
  outputPath,
  PNG.sync.write(output, {
    colorType: 6,
    inputColorType: 6,
    inputHasAlpha: true,
  }),
);

const normalizedDoor = measureDoorInterior(output);
console.log(
  `normalized ${sourceDoor.width}x${sourceDoor.height} -> ${normalizedDoor.width}x${normalizedDoor.height} (target ${targetDoor.width}x${targetDoor.height})`,
);
