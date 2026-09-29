#!/usr/bin/env node
// Kept as an explicit migration error rather than silently warping Kit v3 poses.
console.error("Retired: v1 warm-white-region normalization distorts Kit v3 poses. Review design/jango/manifest.json, then run mascot:sync and mascot:build.");
process.exitCode = 1;
