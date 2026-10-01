#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { alphaBounds, assertSamePixels, assertTransparentPadding, charactersDir, expectedMaster, readManifest } from "./sync-mascot-sources.mjs";

// v18 source hashes and deterministic content fitting protect the selected pose.
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
