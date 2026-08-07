import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, "..");
const update = process.argv.includes("--update");
const profile =
  process.argv.find((argument) => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1]) ??
  process.env.LAYOUT_PROFILE ??
  "small-three-button";
const currentDir = path.join(mobileDir, "e2e", "screenshots", "current", profile);
const baselineDir = path.join(mobileDir, "e2e", "screenshots", "baseline", profile);
const diffDir = path.join(mobileDir, "e2e", "screenshots", "diff", profile);
const maximumDiffRatio = Number(process.env.SCREENSHOT_MAX_DIFF_RATIO ?? "0.005");
const allowMissingBaselines =
  process.env.ALLOW_MISSING_SCREENSHOT_BASELINES === "1";

if (!fs.existsSync(currentDir)) {
  throw new Error(`Current screenshot directory does not exist: ${currentDir}`);
}

const currentFiles = fs
  .readdirSync(currentDir)
  .filter((file) => file.endsWith(".png"))
  .sort();

if (currentFiles.length === 0) {
  throw new Error(`No PNG screenshots found in ${currentDir}`);
}

fs.mkdirSync(baselineDir, { recursive: true });

if (update) {
  for (const file of currentFiles) {
    fs.copyFileSync(path.join(currentDir, file), path.join(baselineDir, file));
  }
  console.log(`Updated ${currentFiles.length} baseline screenshots for ${profile}.`);
  process.exit(0);
}

fs.mkdirSync(diffDir, { recursive: true });
let failures = 0;

for (const file of currentFiles) {
  const currentPath = path.join(currentDir, file);
  const baselinePath = path.join(baselineDir, file);
  const diffPath = path.join(diffDir, file);

  if (!fs.existsSync(baselinePath)) {
    const message = `Missing baseline: ${baselinePath}`;
    if (allowMissingBaselines) {
      console.warn(`${message} (capture uploaded as a CI artifact)`);
    } else {
      console.error(message);
      failures += 1;
    }
    continue;
  }

  const current = PNG.sync.read(fs.readFileSync(currentPath));
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));

  if (current.width !== baseline.width || current.height !== baseline.height) {
    console.error(
      `${file}: dimensions changed from ${baseline.width}x${baseline.height} to ${current.width}x${current.height}`,
    );
    failures += 1;
    continue;
  }

  const diff = new PNG({ width: current.width, height: current.height });
  const differentPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    current.width,
    current.height,
    {
      threshold: 0.12,
      includeAA: false,
    },
  );
  const diffRatio = differentPixels / (current.width * current.height);

  if (diffRatio > maximumDiffRatio) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    console.error(
      `${file}: ${(diffRatio * 100).toFixed(3)}% differs (allowed ${(maximumDiffRatio * 100).toFixed(3)}%)`,
    );
    failures += 1;
  } else {
    fs.rmSync(diffPath, { force: true });
    console.log(`${file}: visual diff accepted (${(diffRatio * 100).toFixed(3)}%).`);
  }
}

if (failures > 0) {
  throw new Error(`${failures} screenshot regression(s) detected for ${profile}.`);
}
