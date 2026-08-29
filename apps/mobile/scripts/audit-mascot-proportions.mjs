#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const charactersDir = path.resolve(scriptDir, "../assets/characters");
const shouldCheck = process.argv.includes("--check");
const tolerance = 0.015;
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
  {
    name: "full",
    targetWidth: 473,
    targetHeight: 365,
    assetPath: (mood) => path.join(charactersDir, `jango-${mood}.png`),
  },
  {
    name: "small",
    targetWidth: 583,
    targetHeight: 450,
    assetPath: (mood) =>
      path.join(charactersDir, "small", `jango-${mood}-small.png`),
  },
];

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

function measureLargestWarmWhiteRegion(assetPath) {
  const png = PNG.sync.read(fs.readFileSync(assetPath));
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
      largest = {
        area,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
    }
  }

  if (!largest) throw new Error(`Could not measure door interior in ${assetPath}`);
  return largest;
}

function formatDelta(value) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

let failureCount = 0;

for (const variant of variants) {
  console.log(`\n${variant.name} (${variant.targetWidth}x${variant.targetHeight})`);

  for (const mood of moods) {
    const measurement = measureLargestWarmWhiteRegion(variant.assetPath(mood));
    const widthDelta = measurement.width / variant.targetWidth - 1;
    const heightDelta = measurement.height / variant.targetHeight - 1;
    const passed =
      Math.abs(widthDelta) <= tolerance && Math.abs(heightDelta) <= tolerance;

    if (!passed) failureCount += 1;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${mood.padEnd(7)} ${String(measurement.width).padStart(3)}x${String(measurement.height).padEnd(3)} width ${formatDelta(widthDelta).padStart(6)} height ${formatDelta(heightDelta).padStart(6)}`,
    );
  }
}

if (shouldCheck && failureCount > 0) {
  console.error(`\n${failureCount} mascot asset(s) exceed ±${tolerance * 100}%`);
  process.exit(1);
}
