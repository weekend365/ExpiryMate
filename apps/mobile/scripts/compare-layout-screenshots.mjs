import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import {
  getLayoutProfile,
  layoutScreenshotNames,
} from "./layout-screenshot-manifest.mjs";
import {
  classifyScreenshotDiff,
  getCaptureContractIssues,
  hasExpectedDimensions,
} from "./screenshot-comparison-core.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, "..");
const arguments_ = process.argv.slice(2);
const update = arguments_.includes("--update");
const profile =
  arguments_.find((argument) => !argument.startsWith("--")) ??
  process.env.LAYOUT_PROFILE ??
  "small-three-button";
const profileConfiguration = getLayoutProfile(profile);
const currentDir = path.join(mobileDir, "e2e", "screenshots", "current", profile);
const baselineDir = path.join(mobileDir, "e2e", "screenshots", "baseline", profile);
const diffDir = path.join(mobileDir, "e2e", "screenshots", "diff", profile);
const resultDir = path.join(mobileDir, "e2e", "results", profile);
const summaryPath = path.join(resultDir, "visual-comparison.json");
const maximumDiffRatio = Number(process.env.SCREENSHOT_MAX_DIFF_RATIO ?? "0.005");
const writeDiffRatio = Number(process.env.SCREENSHOT_WRITE_DIFF_RATIO ?? "0.0001");
const allowMissingBaselines =
  process.env.ALLOW_MISSING_SCREENSHOT_BASELINES === "1";

const summary = {
  profile,
  description: profileConfiguration.description,
  expectedDimensions: {
    width: profileConfiguration.width,
    height: profileConfiguration.height,
  },
  maximumDiffRatio,
  allowMissingBaselines,
  updated: update,
  files: [],
};

function finish(failures) {
  fs.mkdirSync(resultDir, { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify({ ...summary, failures }, null, 2)}\n`);
  if (failures > 0) {
    throw new Error(
      `${failures} screenshot contract or regression failure(s) detected for ${profile}.`,
    );
  }
}

if (!fs.existsSync(currentDir)) {
  throw new Error(`Current screenshot directory does not exist: ${currentDir}`);
}

const currentFiles = fs
  .readdirSync(currentDir)
  .filter((file) => file.endsWith(".png"))
  .sort();
const captureContractIssues = getCaptureContractIssues(
  currentFiles,
  layoutScreenshotNames,
);
let failures = 0;

for (const issue of captureContractIssues) {
  const label =
    issue.status === "missing-current" ? "Missing required" : "Unexpected";
  console.error(`${label} capture: ${path.join(currentDir, issue.file)}`);
  summary.files.push(issue);
  failures += 1;
}

const readableCurrentImages = new Map();
for (const file of layoutScreenshotNames.filter((name) => currentFiles.includes(name))) {
  const currentPath = path.join(currentDir, file);
  const current = PNG.sync.read(fs.readFileSync(currentPath));
  if (!hasExpectedDimensions(current, profileConfiguration)) {
    console.error(
      `${file}: expected ${profileConfiguration.width}x${profileConfiguration.height}, received ${current.width}x${current.height}`,
    );
    summary.files.push({
      file,
      status: "invalid-current-dimensions",
      width: current.width,
      height: current.height,
    });
    failures += 1;
    continue;
  }
  readableCurrentImages.set(file, current);
}

fs.mkdirSync(baselineDir, { recursive: true });

if (update) {
  if (failures > 0) {
    finish(failures);
  }
  for (const file of fs.readdirSync(baselineDir)) {
    if (file.endsWith(".png")) {
      fs.rmSync(path.join(baselineDir, file));
    }
  }
  for (const [file] of readableCurrentImages) {
    fs.copyFileSync(path.join(currentDir, file), path.join(baselineDir, file));
    summary.files.push({ file, status: "baseline-updated" });
  }
  console.log(`Updated ${readableCurrentImages.size} baseline screenshots for ${profile}.`);
  finish(failures);
  process.exit(0);
}

fs.rmSync(diffDir, { recursive: true, force: true });
fs.mkdirSync(diffDir, { recursive: true });

for (const [file, current] of readableCurrentImages) {
  const baselinePath = path.join(baselineDir, file);
  const diffPath = path.join(diffDir, file);

  if (!fs.existsSync(baselinePath)) {
    const message = `Missing baseline: ${baselinePath}`;
    summary.files.push({ file, status: "missing-baseline" });
    if (allowMissingBaselines) {
      console.warn(`${message} (capture retained as a baseline candidate)`);
    } else {
      console.error(message);
      failures += 1;
    }
    continue;
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  if (current.width !== baseline.width || current.height !== baseline.height) {
    console.error(
      `${file}: dimensions changed from ${baseline.width}x${baseline.height} to ${current.width}x${current.height}`,
    );
    summary.files.push({
      file,
      status: "baseline-dimension-mismatch",
      baselineWidth: baseline.width,
      baselineHeight: baseline.height,
      currentWidth: current.width,
      currentHeight: current.height,
    });
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
  const status = classifyScreenshotDiff(
    diffRatio,
    maximumDiffRatio,
    writeDiffRatio,
  );
  const regression = status === "regression";

  if (diffRatio > writeDiffRatio) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  summary.files.push({
    file,
    status,
    differentPixels,
    diffRatio,
  });

  if (regression) {
    console.error(
      `${file}: ${(diffRatio * 100).toFixed(3)}% differs (allowed ${(maximumDiffRatio * 100).toFixed(3)}%)`,
    );
    failures += 1;
  } else {
    console.log(`${file}: visual diff accepted (${(diffRatio * 100).toFixed(3)}%).`);
  }
}

finish(failures);
