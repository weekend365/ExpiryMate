#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(
  mobileDir,
  "assets/characters/jango-icon-crop.png",
);
const iconPath = path.join(mobileDir, "assets/branding/icon.png");
const adaptivePath = path.join(
  mobileDir,
  "assets/branding/adaptive-icon.png",
);
const nativeIconPath = path.join(
  mobileDir,
  "ios/ExpiryMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png",
);
const shouldCheck = process.argv.includes("--check");
const expectedSize = 1024;
const iconBackground = [241, 243, 245];

function readPng(assetPath) {
  return PNG.sync.read(fs.readFileSync(assetPath));
}

function alphaBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  let softAlphaCount = 0;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (alpha > 0 && alpha < 255) softAlphaCount += 1;
    }
  }

  if (maxX < 0) throw new Error("Icon source has no visible pixels");
  return { minX, minY, maxX, maxY, softAlphaCount };
}

function nonBackgroundBounds(png) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      const isBackground = iconBackground.every(
        (channel, offset) => png.data[index + offset] === channel,
      );
      if (!isBackground) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) throw new Error("Opaque icon contains only its background");
  return { minX, minY, maxX, maxY };
}

function isMintPixel(png, x, y) {
  const index = (y * png.width + x) * 4;
  const red = png.data[index];
  const green = png.data[index + 1];
  const blue = png.data[index + 2];
  const alpha = png.data[index + 3];
  return (
    alpha >= 180 &&
    green >= 115 &&
    green >= red + 28 &&
    green >= blue + 8
  );
}

function measureThumbMint(png, side) {
  const xStart = side === "left" ? 150 : 620;
  const xEnd = side === "left" ? 430 : 900;
  const yStart = 680;
  const yEnd = 950;
  let count = 0;
  let yTotal = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      if (isMintPixel(png, x, y)) {
        count += 1;
        yTotal += y;
      }
    }
  }

  return { count, centroidY: count > 0 ? yTotal / count : 0 };
}

function cornerAlphas(png) {
  return [
    png.data[3],
    png.data[(png.width - 1) * 4 + 3],
    png.data[(png.height - 1) * png.width * 4 + 3],
    png.data[(png.width * png.height - 1) * 4 + 3],
  ];
}

const checks = [];
function check(name, passed, detail) {
  checks.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

const source = readPng(sourcePath);
const icon = readPng(iconPath);
const adaptive = readPng(adaptivePath);
const sourceBounds = alphaBounds(source);
const iconBounds = nonBackgroundBounds(icon);
const adaptiveBounds = alphaBounds(adaptive);
const leftThumb = measureThumbMint(source, "left");
const rightThumb = measureThumbMint(source, "right");
const thumbAreaRatio = leftThumb.count / rightThumb.count;
const sourceCenterX = (sourceBounds.minX + sourceBounds.maxX) / 2;

check(
  "source format",
  source.width === expectedSize && source.height === expectedSize && source.alpha,
  `${source.width}x${source.height} alpha=${source.alpha}`,
);
check(
  "source transparent corners",
  cornerAlphas(source).every((alpha) => alpha === 0),
  cornerAlphas(source).join(","),
);
check(
  "source soft edge",
  sourceBounds.softAlphaCount > 0,
  `${sourceBounds.softAlphaCount} antialiased pixels`,
);
check(
  "source canvas safety",
  sourceBounds.minY >= 16 &&
    sourceBounds.maxY <= expectedSize - 17 &&
    Math.abs(sourceCenterX - expectedSize / 2) <= 16,
  `bbox=${sourceBounds.minX},${sourceBounds.minY}..${sourceBounds.maxX},${sourceBounds.maxY} centerX=${sourceCenterX.toFixed(1)}`,
);
check(
  "two-thumb balance",
  thumbAreaRatio >= 0.9 &&
    thumbAreaRatio <= 1.1 &&
    Math.abs(leftThumb.centroidY - rightThumb.centroidY) <= 12,
  `area ratio=${thumbAreaRatio.toFixed(3)} y-delta=${Math.abs(leftThumb.centroidY - rightThumb.centroidY).toFixed(1)}`,
);
check(
  "opaque app icon",
  icon.width === expectedSize && icon.height === expectedSize && !icon.alpha,
  `${icon.width}x${icon.height} alpha=${icon.alpha}`,
);
check(
  "app icon content inset",
  iconBounds.minX >= 40 &&
    iconBounds.minY >= 40 &&
    iconBounds.maxX <= expectedSize - 41 &&
    iconBounds.maxY <= expectedSize - 41,
  `bbox=${iconBounds.minX},${iconBounds.minY}..${iconBounds.maxX},${iconBounds.maxY}`,
);
check(
  "adaptive icon safe zone",
  adaptive.width === expectedSize &&
    adaptive.height === expectedSize &&
    adaptive.alpha &&
    cornerAlphas(adaptive).every((alpha) => alpha === 0) &&
    adaptiveBounds.minX >= 128 &&
    adaptiveBounds.minY >= 128 &&
    adaptiveBounds.maxX <= expectedSize - 129 &&
    adaptiveBounds.maxY <= expectedSize - 129,
  `bbox=${adaptiveBounds.minX},${adaptiveBounds.minY}..${adaptiveBounds.maxX},${adaptiveBounds.maxY}`,
);

if (fs.existsSync(nativeIconPath)) {
  check(
    "native iOS icon sync",
    Buffer.compare(fs.readFileSync(iconPath), fs.readFileSync(nativeIconPath)) === 0,
    path.relative(mobileDir, nativeIconPath),
  );
}

const failureCount = checks.filter((item) => !item.passed).length;
if (shouldCheck && failureCount > 0) {
  console.error(`\n${failureCount} branding audit check(s) failed`);
  process.exit(1);
}
