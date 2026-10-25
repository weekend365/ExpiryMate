import "reflect-metadata";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";
import { evaluationCaseSchema, inventoryPhotoParseResponseSchema } from "@expirymate/shared";
import { RecipesService, RECIPE_AI_PROMPT_VERSION } from "../src/modules/recipes/recipes.service";
import { InventoryPhotoParseService, PHOTO_AI_PROMPT_VERSION, PhotoParseGenerationError } from "../src/modules/inventory/inventory-photo-parse.service";
import { normalizePhotoParseItems } from "../src/modules/inventory/inventory-photo-parse.normalize";
import { prepareVisionImage } from "../src/modules/inventory/inventory-photo-parse.image";
import { calculateOpenAiCostUsd, getOpenAiModelPricing, OPENAI_PRICING_VERSION } from "../src/common/openai-model-config";
import { syntheticRecipeCases } from "./ai-evaluation-cases";
import { runEvaluationJobs } from "./ai-evaluation-scheduler";

function arg(name: string) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }

async function main() {
  const manifest = arg("--cases");
  const feature = arg("--feature") ?? "recipe";
  const models = (arg("--models") ?? (feature === "photo" ? "gpt-4.1-mini,gpt-5.6-luna,gpt-6-luna" : "gpt-5.4-mini,gpt-6-luna,gpt-6.1-sol")).split(",").map(value => value.trim());
  models.forEach(getOpenAiModelPricing);
  if (new Set(models).size !== models.length) throw new Error("Duplicate evaluation models.");
  const repetitions = Number(arg("--repetitions") ?? (feature === "photo" ? 2 : 3));
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error("Invalid repetition count.");
  const concurrency = Number(arg("--concurrency") ?? 1);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new Error("Invalid concurrency (1–6).");
  const cases = manifest ? readFileSync(manifest, "utf8").split(/\r?\n/).filter(Boolean).map(line => evaluationCaseSchema.parse(JSON.parse(line))) : syntheticRecipeCases();
  const limit = Number(arg("--limit") ?? cases.length);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid case limit.");
  const selected = cases.filter(item => item.feature === feature).slice(0, limit);
  if (!selected.length) throw new Error("No evaluation cases for this feature. Photos require an approved/synthetic local manifest.");
  if (new Set(selected.map(item => item.id)).size !== selected.length) throw new Error("Duplicate case IDs.");
  const imageDigests = new Map<string, string>();
  for (const item of selected) if (item.feature === "photo") {
    const bytes = readFileSync(resolve(manifest ? dirname(manifest) : process.cwd(), item.imagePath));
    if (bytes.length > 4 * 1024 * 1024 || !prepareVisionImage(bytes)) throw new Error("Invalid evaluation image.");
    imageDigests.set(item.id, createHash("sha256").update(new Uint8Array(bytes)).digest("hex"));
  }
  const datasetHash = createHash("sha256").update(JSON.stringify([selected, [...imageDigests]])).digest("hex");
  if (arg("--expected-dataset-hash") && arg("--expected-dataset-hash") !== datasetHash) {
    throw new Error("Evaluation inputs changed after baseline preflight.");
  }
  if (arg("--write-cases")) writeFileSync(arg("--write-cases")!, selected.map(item => JSON.stringify(item)).join("\n") + "\n");
  process.stdout.write(JSON.stringify({ mode: process.argv.includes("--run") ? "run" : "plan", feature, cases: selected.length, repetitions, models, requests: selected.length * repetitions * models.length, concurrency, datasetHash, pricingVersion: OPENAI_PRICING_VERSION,
    promptVersion: feature === "photo" ? PHOTO_AI_PROMPT_VERSION : RECIPE_AI_PROMPT_VERSION,
    imageDigests: Object.fromEntries(imageDigests) }) + "\n");
  if (!process.argv.includes("--run")) return;
  // Deliberate CLI execution only. No database, quota, production env, or image retention.
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required; no environment file is loaded by this runner.");
  const budget = Number(arg("--max-cost-usd"));
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("--max-cost-usd is required.");
  const output = arg("--output");
  if (!output || existsSync(output)) throw new Error("--output must be a new local JSONL file.");
  writeFileSync(output, "", { mode: 0o600, flag: "wx" });
  // Rotate model order to balance time-of-run effects; each request gets its own failure capture.
  const jobs = Array.from({ length: repetitions }, (_, repeat) => selected.flatMap((item, index) =>
    models.map((_, offset) => ({ item, repeat, model: models[(index + repeat + offset) % models.length]! })))).flat();
  const progress = new Map<typeof jobs[number], Record<string, unknown>>();
  Logger.overrideLogger(false);
  const spent = await runEvaluationJobs({ jobs, concurrency, budgetUsd: budget,
    allowance: ({ item, model }) => item.feature === "photo" ? 0.10 : (model.startsWith("gpt-6.1-sol") ? 0.50 : 0.15),
    run: async job => {
    const { item, repeat, model } = job;
    const captured: { last?: Record<string, unknown> } = {};
    const recipes = new RecipesService({ recipeAiGenerationEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { captured.last = data; } } } as never, {} as never, {} as never, {} as never, {} as never);
    const photos = new InventoryPhotoParseService({} as never, {} as never);
    const start = Date.now();
    let result: Record<string, unknown>;
    try {
      if (item.feature === "recipe") {
        const generation = await recipes.generateRecommendations(`eval:${item.id}`, item.request, item.inventory, item.preference,
          { positiveDishTitles: [], dismissedDishTitles: [], recentDishTitles: [] }, { model, variant: process.argv.includes("--baseline") ? "control" : "candidate" });
        result = { status: "succeeded", ...generation };
      } else {
        const imagePath = resolve(manifest ? dirname(manifest) : process.cwd(), item.imagePath);
        const buffer = readFileSync(imagePath);
        if (createHash("sha256").update(new Uint8Array(buffer)).digest("hex") !== imageDigests.get(item.id)) throw new Error("Evaluation image changed after preflight.");
        const image = prepareVisionImage(buffer);
        if (!image) throw new Error("Unsupported image.");
        const generation = await photos.recognizeItems(item.scene, image, model, `eval:${item.id}`);
        const parsed = inventoryPhotoParseResponseSchema.parse({ scene: item.scene, items: normalizePhotoParseItems(item.scene, generation.items) });
        const actual = parsed.items.map(value => value.displayName.trim().toLocaleLowerCase("ko-KR"));
        const expected = new Set(item.expectedNames.map(value => value.trim().toLocaleLowerCase("ko-KR")));
        const matches = new Set(actual.filter(value => expected.has(value))).size;
        result = { status: "succeeded", usage: generation.usage, estimatedCostUsd: generation.estimatedCostUsd,
          generationAttempts: 1, photoExactNameF1: 2 * matches / (new Set(actual).size + expected.size), items: parsed.items };
      }
    } catch (error) {
      const failure = captured.last as Record<string, unknown> | undefined;
      result = error instanceof PhotoParseGenerationError
        ? { status: "failed", failureCode: error.failureCode, usage: error.usage, estimatedCostUsd: calculateOpenAiCostUsd(error.usage, model), generationAttempts: 1 }
        : { status: "failed", failureCode: failure?.failureCode ?? "provider_error", estimatedCostUsd: Number(failure?.estimatedCostUsd ?? 0), usage: { usageStatus: failure?.usageStatus ?? "unavailable" }, generationAttempts: failure?.generationAttempts ?? 1 };
    }
    appendFileSync(output, JSON.stringify({ caseId: item.id, datasetHash, model, repeat, feature: item.feature,
      scene: item.feature === "photo" ? item.scene : null, promptVersion: item.feature === "photo" ? PHOTO_AI_PROMPT_VERSION : RECIPE_AI_PROMPT_VERSION, pricingVersion: OPENAI_PRICING_VERSION,
      durationMs: Date.now() - start, ...result }) + "\n");
    const usageStatus = (result.usage as { usageStatus?: string }).usageStatus;
    progress.set(job, { caseId: item.id, model, repeat, status: result.status, usageStatus });
    return { costUsd: Number(result.estimatedCostUsd), accountingComplete: usageStatus === "reported" };
    },
    settled: (job, totalCostUsd) => {
      process.stdout.write(JSON.stringify({ ...progress.get(job), knownCostUsd: totalCostUsd }) + "\n");
      progress.delete(job);
    },
  });
  process.stdout.write(JSON.stringify({ completed: jobs.length, knownCostUsd: spent }) + "\n");
}

main().catch(() => { process.stderr.write("Evaluation stopped. Check configuration, budget, and the local result file; no raw provider errors are logged.\n"); process.exitCode = 1; });
