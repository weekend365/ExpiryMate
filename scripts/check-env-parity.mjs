/**
 * Ensures production-critical API env KEYS appear in example/staging templates.
 * Does not validate placeholder VALUES (those are intentionally incomplete).
 *
 * Source of truth: apps/api/src/config/production-env.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const productionEnvSource = readFileSync(
  join(root, "apps/api/src/config/production-env.ts"),
  "utf8",
);

const requiredBlock = productionEnvSource.match(
  /const REQUIRED_PRODUCTION_VALUES = \[([\s\S]*?)\] as const/,
)?.[1];

if (!requiredBlock) {
  console.error(
    "[env-parity] Could not parse REQUIRED_PRODUCTION_VALUES from production-env.ts",
  );
  process.exit(1);
}

const REQUIRED_KEYS = [
  ...[...requiredBlock.matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]),
  "AUTH_LINK_BASE_URL",
  "AUTH_ALLOW_DEV_FALLBACK",
];

const TARGET_FILES = [
  "apps/api/.env.production.example",
  "docs/env.staging.example",
];

function keysInEnvFile(relativePath) {
  const content = readFileSync(join(root, relativePath), "utf8");
  const keys = new Set();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      keys.add(match[1]);
    }
  }

  return keys;
}

let failed = false;

for (const file of TARGET_FILES) {
  const present = keysInEnvFile(file);
  const missing = REQUIRED_KEYS.filter((key) => !present.has(key));

  if (missing.length > 0) {
    failed = true;
    console.error(
      `[env-parity] ${file} is missing required production keys:\n` +
        missing.map((key) => `  - ${key}`).join("\n"),
    );
  } else {
    console.log(`[env-parity] ${file} OK (${REQUIRED_KEYS.length} keys present)`);
  }
}

const staging = readFileSync(join(root, "docs/env.staging.example"), "utf8");

if (!/^NODE_ENV=production\b/m.test(staging)) {
  failed = true;
  console.error(
    "[env-parity] docs/env.staging.example should set NODE_ENV=production " +
      "(Railway staging uses the production validator)",
  );
}

const mobileCors = staging.match(/^CORS_ORIGIN_MOBILE=(.*)$/m)?.[1]?.trim();
if (!mobileCors || !mobileCors.startsWith("https://")) {
  failed = true;
  console.error(
    "[env-parity] docs/env.staging.example CORS_ORIGIN_MOBILE must be https:// " +
      `when NODE_ENV=production (got: ${mobileCors ?? "(missing)"})`,
  );
}

const appleEnv = staging
  .match(/^APPLE_APP_STORE_ENVIRONMENT=(.*)$/m)?.[1]
  ?.trim();
if (appleEnv !== "production") {
  failed = true;
  console.error(
    "[env-parity] docs/env.staging.example APPLE_APP_STORE_ENVIRONMENT must be " +
      `production when NODE_ENV=production (got: ${appleEnv ?? "(missing)"})`,
  );
}

if (failed) {
  process.exit(1);
}

console.log("[env-parity] all checks passed");
