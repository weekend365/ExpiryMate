#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { alphaBounds, assertSamePixels, assertTransparentPadding, charactersDir, expectedMaster, readManifest } from "./sync-mascot-sources.mjs";

// Kit v3 includes rotation and lifted feet. The old warm-white connected region
// and idle-aligned baseline were not measurements of anatomical face geometry.
// Reviewed source hashes plus deterministic uniform scaling protect each pose;
// anatomical landmarks remain a separate, recorded visual/BIBLE review.
for (const entry of readManifest().poses) {
  const expected = expectedMaster(entry);
  const actual = PNG.sync.read(fs.readFileSync(path.join(charactersDir, `jango-${entry.mood}.png`)));
  assertTransparentPadding(actual, entry.mood);
  assertSamePixels(actual, expected, entry.mood);
  if (JSON.stringify(alphaBounds(actual)) !== JSON.stringify(entry.expectedBounds)) {
    throw new Error(`${entry.mood}: reviewed pose bounds changed`);
  }
  console.log(`PASS ${entry.mood}: reviewed source, pose bounds, uniform scale and transparent edges`);
}
