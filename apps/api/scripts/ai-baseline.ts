import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluationCaseSchema } from "@expirymate/shared";
import { z } from "zod";
import { baselineGradeSchema, baselineManifestSchema, baselineResultSchema, evaluateBaseline, type BaselineManifest } from "./ai-baseline-report";

const arg = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const lines = (path: string): unknown[] => readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown);
const planSchema = z.object({ datasetHash: z.string(), pricingVersion: z.string(), promptVersion: z.string(), cases: z.number(), imageDigests: z.record(z.string(), z.string()) });
const apiDirectory = resolve(__dirname, "..");

/** Explicit runtime snapshot: no app env files, production DB, or rollout settings are loaded. */
function runtimeSnapshot() {
  const defaults: Record<string, string> = {
    RECIPE_AI_MODEL: "gpt-5.4-mini", INVENTORY_PHOTO_PARSE_MODEL: "gpt-5.6-luna",
    RECIPE_AI_MAX_OUTPUT_TOKENS: "3500", INVENTORY_PHOTO_PARSE_MAX_OUTPUT_TOKENS: "1800",
    RECIPE_AI_REQUEST_TIMEOUT_MS: "45000", RECIPE_AI_DEADLINE_MS: "60000",
    INVENTORY_PHOTO_PARSE_REQUEST_TIMEOUT_MS: "30000", INVENTORY_PHOTO_PARSE_DEADLINE_MS: "45000",
  };
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, process.env[key]?.trim() || fallback]));
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

function report(directory: string) {
  const manifest = baselineManifestSchema.parse(JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")));
  const results = ["recipe", "photo"].flatMap((feature) => {
    const path = join(directory, `${feature}-results.jsonl`);
    return existsSync(path) ? lines(path).map((row) => baselineResultSchema.parse(row)) : [];
  });
  const grades = arg("--grades") ? lines(arg("--grades")!).map((row) => baselineGradeSchema.parse(row)) : [];
  const value = evaluateBaseline(manifest, results, grades);
  writeJson(join(directory, "report.json"), value);
  return value;
}

function main() {
  const directoryArg = arg("--output-dir");
  if (!directoryArg) throw new Error("--output-dir is required.");
  const directory = resolve(directoryArg);
  if (process.argv.includes("--report")) {
    const value = report(directory);
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
    if (!value.complete || value.policy.status !== "passed") process.exitCode = 1;
    return;
  }
  const runtimeSource = arg("--runtime-source");
  const usdKrw = Number(arg("--usd-krw"));
  const budget = Number(arg("--max-cost-usd") ?? "5");
  if (!runtimeSource || !Number.isFinite(usdKrw) || usdKrw <= 0
    || !Number.isFinite(budget) || budget <= 0 || budget > 5) {
    throw new Error("Supply --runtime-source, --usd-krw, and a total budget no greater than $5.");
  }
  const photoPath = arg("--photo-cases");
  if (!photoPath) throw new Error("--photo-cases must contain 15 approved receipts and 15 approved fridge photos.");
  const recipePath = resolve(arg("--recipe-cases") ?? join(apiDirectory, "../../docs/operations/ai-evaluations/recipe-cases-2026-10-08.jsonl"));
  const recipes = lines(recipePath).map((row) => evaluationCaseSchema.parse(row)).filter((row) => row.feature === "recipe").slice(0, 50);
  const photos = lines(resolve(photoPath)).map((row) => evaluationCaseSchema.parse(row));
  if (recipes.length !== 50 || photos.length !== 30 || photos.some((row) => row.feature !== "photo" || row.dataPolicy !== "approved")
    || ["receipt", "fridge"].some((scene) => photos.filter((row) => row.feature === "photo" && row.scene === scene).length !== 15)) {
    throw new Error("Baseline requires 50 recipe cases and 15 approved images per photo scene.");
  }
  const runtime = runtimeSnapshot();
  const specifications = [
    { feature: "recipe" as const, path: recipePath, cases: recipes, model: runtime.RECIPE_AI_MODEL! },
    { feature: "photo" as const, path: resolve(photoPath), cases: photos, model: runtime.INVENTORY_PHOTO_PARSE_MODEL! },
  ];
  const childArgs = (specification: typeof specifications[number]) => [
    "--import", "tsx", join(__dirname, "ai-evaluation.ts"), "--baseline",
    "--feature", specification.feature, "--cases", specification.path, "--models", specification.model,
    "--limit", String(specification.cases.length), "--repetitions", "1", "--concurrency", "1",
  ];
  const plans = specifications.map((specification) => {
    const check = spawnSync(process.execPath, childArgs(specification), { cwd: apiDirectory, env: { ...process.env, ...runtime }, encoding: "utf8" });
    if (check.status !== 0) throw new Error(`Invalid ${specification.feature} manifest or image; preflight failed without paid calls.`);
    return planSchema.parse(JSON.parse(check.stdout.trim()));
  });
  const manifest: BaselineManifest = {
    version: 1, createdAt: new Date().toISOString(), runtimeSource, usdKrw, budgetUsd: budget, runtime,
    ...Object.fromEntries(specifications.map((specification, index) => [specification.feature, {
      ...plans[index], model: specification.model,
      cases: specification.cases.map((item) => ({ id: item.id, scene: item.feature === "photo" ? item.scene : null })),
    }])) as Pick<BaselineManifest, "recipe" | "photo">,
  };
  baselineManifestSchema.parse(manifest);
  process.stdout.write(JSON.stringify({ mode: "plan", ...manifest }) + "\n");
  if (!process.argv.includes("--run")) return;
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required.");
  // A new directory is mandatory: an interrupted/unknown bill must never reset the budget.
  if (existsSync(directory)) throw new Error("Use a new output directory; automatic retries/resume are prohibited.");
  mkdirSync(directory, { mode: 0o700, recursive: true });
  writeJson(join(directory, "manifest.json"), manifest);
  writeJson(join(directory, "input-locations.json"), Object.fromEntries(
    specifications.map((specification) => [specification.feature, specification.path]),
  ));
  for (const specification of specifications) {
    // Preserve the exact path strings used in datasetHash. Images stay at their
    // approved source location; the runner does not silently duplicate originals.
    writeFileSync(join(directory, `${specification.feature}-cases.jsonl`), specification.cases.map((item) => JSON.stringify(item)).join("\n") + "\n", { mode: 0o600 });
  }
  let knownCostUsd = 0;
  let stopped = false;
  for (const specification of specifications) {
    const remaining = Math.round((budget - knownCostUsd) * 1e6) / 1e6;
    if (remaining <= 0) { stopped = true; break; }
    writeJson(join(directory, "state.json"), { state: "running", feature: specification.feature, knownCostUsd, remainingBudgetUsd: remaining });
    const output = join(directory, `${specification.feature}-results.jsonl`);
    const result = spawnSync(process.execPath, [...childArgs(specification), "--expected-dataset-hash", manifest[specification.feature].datasetHash,
      "--run", "--max-cost-usd", String(remaining), "--output", output], {
      cwd: apiDirectory, env: { ...process.env, ...runtime }, stdio: "inherit",
    });
    const current = report(directory);
    knownCostUsd = current.total.knownCostUsd;
    if (result.status !== 0 || !current.total.accountingComplete || knownCostUsd > budget) { stopped = true; break; }
  }
  const final = report(directory);
  writeJson(join(directory, "state.json"), { state: stopped ? "stopped" : "completed", knownCostUsd, requiresQualityReview: true });
  process.stdout.write(JSON.stringify({ state: stopped ? "stopped" : "completed", knownCostUsd, report: join(directory, "report.json") }) + "\n");
  if (stopped || !final.complete) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch {
    process.stderr.write("Baseline stopped. Check inputs, runtime snapshot, budget and local artifacts. No provider errors or secrets are printed.\n");
    process.exitCode = 1;
  }
}
