#!/usr/bin/env node
/**
 * Materialize per-app env files for Cursor Cloud Agents.
 *
 * Cursor Secrets land as process.env. Nest/Next/Expo still expect files on disk
 * (apps/api/.env, apps/admin/.env.local, apps/mobile/.env).
 *
 * Resolution per key (highest wins):
 *   1. Prefixed secret: API_*, ADMIN_*, MOBILE_*
 *   2. Unprefixed secret matching the example key
 *   3. Example / cloud default
 *
 * Escape hatch: set API_ENV_FILE / ADMIN_ENV_FILE / MOBILE_ENV_FILE to a full
 * dotenv body to overwrite that app's file entirely.
 *
 * See docs/cursor-cloud-secrets.md
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @typedef {{ path: string, example: string, prefix: string, envFileSecret: string, defaults?: Record<string, string> }} Target */

/** @type {Target[]} */
const TARGETS = [
  {
    path: "apps/api/.env",
    example: "apps/api/.env.example",
    prefix: "API_",
    envFileSecret: "API_ENV_FILE",
    defaults: {
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/expirymate?schema=public",
      PORT: "4000",
      AUTH_ALLOW_DEV_FALLBACK: "false",
      AUTH_RATE_LIMIT_STORE: "database",
      TRUST_PROXY: "1",
      CORS_ORIGIN_ADMIN: "http://localhost:3000",
      CORS_ORIGIN_MOBILE: "http://localhost:8081",
      APP_BASE_URL: "expirymate://",
      AUTH_LINK_BASE_URL: "http://localhost:4000",
      ADMIN_BASE_URL: "http://localhost:3000",
      PRIVACY_POLICY_URL: "http://localhost:3000/privacy",
      PRIVACY_CHOICES_URL: "http://localhost:3000/privacy/choices",
      IAP_ALLOW_SANDBOX_PURCHASES: "true",
      PUSH_REMINDER_SCHEDULER_ENABLED: "false",
    },
  },
  {
    path: "apps/admin/.env.local",
    example: "apps/admin/.env.example",
    prefix: "ADMIN_",
    envFileSecret: "ADMIN_ENV_FILE",
    defaults: {
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000",
    },
  },
  {
    path: "apps/mobile/.env",
    example: "apps/mobile/.env.example",
    prefix: "MOBILE_",
    envFileSecret: "MOBILE_ENV_FILE",
    defaults: {
      EXPO_PUBLIC_APP_ENV: "development",
      EXPO_PUBLIC_API_BASE_URL: "http://localhost:4000",
    },
  },
];

/**
 * @param {string} content
 * @returns {Map<string, string>}
 */
function parseEnv(content) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(match[1], value);
  }
  return map;
}

/**
 * @param {string} value
 * @returns {string}
 */
function quoteIfNeeded(value) {
  if (/[\s#"']/.test(value) || value.includes("\\")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * @param {Target} target
 * @param {Map<string, string>} base
 * @returns {Map<string, string>}
 */
function applySecrets(target, base) {
  const next = new Map(base);
  for (const [key, value] of Object.entries(target.defaults ?? {})) {
    if (!next.has(key) || next.get(key) === "") next.set(key, value);
  }

  for (const key of next.keys()) {
    const prefixed = process.env[`${target.prefix}${key}`];
    const direct = process.env[key];
    if (typeof prefixed === "string" && prefixed.length > 0) {
      next.set(key, prefixed);
    } else if (typeof direct === "string" && direct.length > 0) {
      // Skip unprefixed keys that belong to another app's public surface when
      // this target would collide — only apply if the key exists in this file.
      next.set(key, direct);
    }
  }

  // Allow secrets for keys not present in the example (e.g. RESEND_API_KEY).
  for (const [envKey, envValue] of Object.entries(process.env)) {
    if (!envValue) continue;
    if (envKey.startsWith(target.prefix)) {
      const key = envKey.slice(target.prefix.length);
      if (key && key !== "ENV_FILE") next.set(key, envValue);
    }
  }

  return next;
}

/**
 * @param {Map<string, string>} map
 * @param {string} exampleContent
 * @returns {string}
 */
function serializePreservingComments(map, exampleContent) {
  const seen = new Set();
  const lines = [];

  for (const rawLine of exampleContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      lines.push(rawLine);
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) {
      lines.push(rawLine);
      continue;
    }
    const key = match[1];
    seen.add(key);
    const value = map.get(key) ?? "";
    lines.push(`${key}=${quoteIfNeeded(value)}`);
  }

  for (const [key, value] of map) {
    if (seen.has(key)) continue;
    lines.push(`${key}=${quoteIfNeeded(value)}`);
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function materialize() {
  for (const target of TARGETS) {
    const outPath = join(root, target.path);
    const bulk = process.env[target.envFileSecret];
    if (typeof bulk === "string" && bulk.trim().length > 0) {
      writeFileSync(outPath, bulk.endsWith("\n") ? bulk : `${bulk}\n`, "utf8");
      console.log(`[cursor-cloud-env] wrote ${target.path} from ${target.envFileSecret}`);
      continue;
    }

    const examplePath = join(root, target.example);
    if (!existsSync(examplePath)) {
      console.warn(`[cursor-cloud-env] missing example: ${target.example}`);
      continue;
    }
    const exampleContent = readFileSync(examplePath, "utf8");
    const base = parseEnv(exampleContent);
    const merged = applySecrets(target, base);
    writeFileSync(
      outPath,
      serializePreservingComments(merged, exampleContent),
      "utf8",
    );
    console.log(`[cursor-cloud-env] wrote ${target.path}`);
  }

  const auth = process.env.API_AUTH_TOKEN_SECRET || process.env.AUTH_TOKEN_SECRET;
  if (!auth || auth.includes("replace-with")) {
    console.warn(
      "[cursor-cloud-env] AUTH_TOKEN_SECRET is missing or still a placeholder. " +
        "Add Runtime Secret AUTH_TOKEN_SECRET (or API_AUTH_TOKEN_SECRET) in Cursor.",
    );
  }
}

materialize();
