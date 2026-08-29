#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const storeDir = path.resolve(scriptDir, "../assets/store");
const officialPath = path.join(storeDir, "google-play-feature-graphic.png");

if (!fs.existsSync(officialPath)) {
  console.error(`Missing official Google Play graphic: ${officialPath}`);
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(officialPath));
const passed = png.width === 1024 && png.height === 500 && !png.alpha;
console.log(
  `${passed ? "PASS" : "FAIL"} ${path.basename(officialPath)} ${png.width}x${png.height} alpha=${png.alpha}`,
);

if (!passed) process.exit(1);
