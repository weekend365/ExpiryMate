#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { PNG } from "pngjs";
import {
  deriveSmallMaster,
  fullAssetPath,
  mascotMoods,
} from "./derive-mascot-small-assets.mjs";

const shouldCheck = process.argv.includes("--check");
const tolerance = 0.015;
const moods = mascotMoods;
const variants = [
  {
    name: "full",
    targetWidth: 473,
    targetHeight: 365,
    enforcePadding: true,
    asset: (mood) => PNG.sync.read(fs.readFileSync(fullAssetPath(mood))),
  },
  {
    name: "small",
    targetWidth: 583,
    targetHeight: 450,
    enforcePadding: false,
    asset: (mood) =>
      deriveSmallMaster(PNG.sync.read(fs.readFileSync(fullAssetPath(mood)))),
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

function measureLargestWarmWhiteRegion(png) {
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
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
    }
  }

  if (!largest) throw new Error("Could not measure door interior");
  return largest;
}

function measureOpaqueBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha <= 16) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) throw new Error("Could not measure mascot bounds");
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function formatDelta(value) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

let failureCount = 0;

for (const variant of variants) {
  console.log(`\n${variant.name} (${variant.targetWidth}x${variant.targetHeight})`);
  const referenceAsset = variant.asset("idle");
  const referenceDoor = measureLargestWarmWhiteRegion(referenceAsset);
  const referenceBounds = measureOpaqueBounds(referenceAsset);
  const referenceDoorCenterX = (referenceDoor.minX + referenceDoor.maxX) / 2;
  const referenceDoorCenterY = (referenceDoor.minY + referenceDoor.maxY) / 2;
  const referenceLowerHeight = referenceBounds.maxY - referenceDoor.maxY;
  const anchorTolerance = Math.max(2, Math.round(referenceAsset.height * 0.003));

  for (const mood of moods) {
    const asset = variant.asset(mood);
    const measurement = measureLargestWarmWhiteRegion(asset);
    const bounds = measureOpaqueBounds(asset);
    const widthDelta = measurement.width / variant.targetWidth - 1;
    const heightDelta = measurement.height / variant.targetHeight - 1;
    const doorCenterX = (measurement.minX + measurement.maxX) / 2;
    const doorCenterY = (measurement.minY + measurement.maxY) / 2;
    const lowerHeight = bounds.maxY - measurement.maxY;
    const lowerHeightDelta = lowerHeight / referenceLowerHeight - 1;
    const passedDoorSize =
      Math.abs(widthDelta) <= tolerance && Math.abs(heightDelta) <= tolerance;
    const passedAnchors =
      Math.abs(doorCenterX - referenceDoorCenterX) <= anchorTolerance &&
      Math.abs(doorCenterY - referenceDoorCenterY) <= anchorTolerance &&
      Math.abs(bounds.maxY - referenceBounds.maxY) <= anchorTolerance;
    const passedLowerHeight = Math.abs(lowerHeightDelta) <= tolerance;
    const passedEdges =
      !variant.enforcePadding ||
      (bounds.minX > 0 &&
        bounds.minY > 0 &&
        bounds.maxX < asset.width - 1 &&
        bounds.maxY < asset.height - 1);
    const passed =
      passedDoorSize && passedAnchors && passedLowerHeight && passedEdges;

    if (!passed) failureCount += 1;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${mood.padEnd(7)} door ${String(measurement.width).padStart(3)}x${String(measurement.height).padEnd(3)} width ${formatDelta(widthDelta).padStart(6)} height ${formatDelta(heightDelta).padStart(6)} lower ${String(lowerHeight).padStart(3)} ${formatDelta(lowerHeightDelta).padStart(6)} baseline ${String(bounds.maxY).padStart(4)}${passedEdges ? "" : " edge-contact"}`,
    );
  }
}

if (shouldCheck && failureCount > 0) {
  console.error(`\n${failureCount} mascot asset(s) exceed ±${tolerance * 100}%`);
  process.exit(1);
}
