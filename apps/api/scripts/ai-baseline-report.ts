import { z } from "zod";
import { evaluationGradeSchema, evaluationResultSchema } from "@expirymate/shared";

const featurePlanSchema = z.object({
  model: z.string().min(1), datasetHash: z.string().min(1),
  promptVersion: z.string().min(1), pricingVersion: z.string().min(1),
  imageDigests: z.record(z.string(), z.string()).default({}),
  cases: z.array(z.object({ id: z.string().min(1), scene: z.enum(["receipt", "fridge"]).nullable() })),
});
export const baselineManifestSchema = z.object({
  version: z.literal(1), createdAt: z.string().datetime(), runtimeSource: z.string().min(1),
  budgetUsd: z.number().positive().max(5), usdKrw: z.number().positive(),
  runtime: z.record(z.string(), z.string()),
  recipe: featurePlanSchema, photo: featurePlanSchema,
});
export type BaselineManifest = z.infer<typeof baselineManifestSchema>;
export const baselineResultSchema = evaluationResultSchema.extend({
  photoExactNameF1: z.number().min(0).max(1).optional(),
});
type Result = z.infer<typeof baselineResultSchema>;
const count = z.number().int().nonnegative();
export const baselineGradeSchema = evaluationGradeSchema.extend({
  photoReview: z.object({
    expectedItems: count, omittedItems: count, misidentifiedItems: count,
    falsePositiveItems: count, quantityErrors: count, inventedDates: count,
  }).refine((value) => value.omittedItems + value.misidentifiedItems <= value.expectedItems).optional(),
  recipeReview: z.object({ constraintChecks: count, constraintViolations: count })
    .refine((value) => value.constraintViolations <= value.constraintChecks).optional(),
  notes: z.array(z.string()).optional(),
});
type Grade = z.infer<typeof baselineGradeSchema>;

function key(row: { datasetHash: string; caseId: string; model: string; repeat: number }) {
  return JSON.stringify([row.datasetHash, row.caseId, row.model, row.repeat]);
}
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 1e6) / 1e6;
function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  if (p === 0.5 && sorted.length % 2 === 0) return (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  return sorted[Math.ceil(sorted.length * p) - 1]!;
}

/** A baseline is descriptive evidence, never a replacement for adoption or sales gates. */
export function evaluateBaseline(manifest: BaselineManifest, results: Result[], grades: Grade[]) {
  baselineManifestSchema.parse(manifest);
  const resultKeys = new Set(results.map(key));
  const gradeMap = new Map(grades.map((grade) => [key(grade), grade]));
  if (resultKeys.size !== results.length || gradeMap.size !== grades.length
    || grades.some((grade) => !resultKeys.has(key(grade)))) throw new Error("Duplicate or unmatched baseline results/grades.");
  for (const feature of ["recipe", "photo"] as const) {
    const plan = manifest[feature];
    if (new Set(plan.cases.map((item) => item.id)).size !== plan.cases.length) throw new Error("Duplicate baseline cases.");
  }
  for (const row of results) {
    const plan = manifest[row.feature];
    const expected = plan.cases.find((item) => item.id === row.caseId);
    if (!expected || row.repeat !== 0 || row.model !== plan.model || row.datasetHash !== plan.datasetHash
      || row.promptVersion !== plan.promptVersion || row.pricingVersion !== plan.pricingVersion
      || row.scene !== expected.scene) throw new Error("Baseline cohort mismatch; do not combine different runs.");
  }
  const issues: string[] = [];
  const recipe = results.filter((row) => row.feature === "recipe");
  const photo = results.filter((row) => row.feature === "photo");
  if (manifest.recipe.cases.length !== 50 || manifest.photo.cases.length !== 30
    || ["receipt", "fridge"].some((scene) => manifest.photo.cases.filter((row) => row.scene === scene).length !== 15)) {
    issues.push("invalid_sample_plan");
  }
  if (results.length !== 80) issues.push("incomplete_run");
  if (results.some((row) => row.usage.usageStatus !== "reported")) issues.push("incomplete_accounting");
  if (results.some((row) => row.status === "failed")) issues.push("generation_failures");
  const successes = results.filter((row) => row.status === "succeeded");
  if (successes.some((row) => !gradeMap.has(key(row)))) issues.push("missing_quality_grades");
  if (successes.some((row) => row.feature === "photo" && !gradeMap.get(key(row))?.photoReview)) issues.push("missing_photo_review");
  if (successes.some((row) => row.feature === "recipe" && !gradeMap.get(key(row))?.recipeReview)) issues.push("missing_recipe_constraint_review");
  if (successes.some((row) => gradeMap.get(key(row))?.safetyPassed === false)) issues.push("safety_failure");
  if (sum(results.map((row) => row.estimatedCostUsd)) > manifest.budgetUsd) issues.push("budget_exceeded");

  const metrics = (rows: Result[]) => {
    const succeeded = rows.filter((row) => row.status === "succeeded");
    const accountingComplete = rows.length > 0 && rows.every((row) => row.usage.usageStatus === "reported");
    const graded = succeeded.flatMap((row) => gradeMap.has(key(row)) ? [gradeMap.get(key(row))!] : []);
    const costs = rows.map((row) => row.estimatedCostUsd);
    const durations = rows.map((row) => row.durationMs);
    const photoReviews = graded.flatMap((grade) => grade.photoReview ? [grade.photoReview] : []);
    const recipeReviews = graded.flatMap((grade) => grade.recipeReview ? [grade.recipeReview] : []);
    return {
      requests: rows.length, successes: succeeded.length,
      successRate: rows.length ? succeeded.length / rows.length : null,
      usageCounts: Object.fromEntries(["reported", "estimated", "partial", "unavailable", "legacy"]
        .map((status) => [status, rows.filter((row) => row.usage.usageStatus === status).length])),
      knownCostUsd: sum(costs), accountingComplete,
      costPerSuccessUsd: accountingComplete && succeeded.length ? sum(costs) / succeeded.length : null,
      p50CostUsd: accountingComplete ? percentile(costs, 0.5) : null,
      p95CostUsd: accountingComplete ? percentile(costs, 0.95) : null,
      p50DurationMs: percentile(durations, 0.5), p95DurationMs: percentile(durations, 0.95),
      gradedSuccesses: graded.length, safetyFailures: graded.filter((grade) => !grade.safetyPassed).length,
      quality: graded.length > 0 && graded.length === succeeded.length ? sum(graded.map((grade) => grade.quality)) / graded.length : null,
      // Exact names are a diagnostic only; aliases, quantity and dates need review.
      photoExactNameF1: percentile(rows.flatMap((row) => row.photoExactNameF1 === undefined ? [] : [row.photoExactNameF1]), 0.5),
      photoReview: {
        reviewedRequests: photoReviews.length,
        counts: photoReviews.length ? Object.fromEntries(
          ["expectedItems", "omittedItems", "misidentifiedItems", "falsePositiveItems", "quantityErrors", "inventedDates"]
            .map((field) => [field, sum(photoReviews.map((review) => review[field as keyof typeof review]))]),
        ) : null,
      },
      recipeConstraintReview: {
        reviewedRequests: recipeReviews.length,
        constraintChecks: recipeReviews.length ? sum(recipeReviews.map((review) => review.constraintChecks)) : null,
        constraintViolations: recipeReviews.length ? sum(recipeReviews.map((review) => review.constraintViolations)) : null,
      },
    };
  };
  // Match the existing guardrail's successful-request population. Overall metrics
  // above also include failures and semantic repair charges.
  const recipeSuccess = recipe.filter((row) => row.status === "succeeded");
  const photoSuccess = photo.filter((row) => row.status === "succeeded");
  const canMeasure = results.length > 0 && results.every((row) => row.usage.usageStatus === "reported");
  const recipeP95 = canMeasure ? percentile(recipeSuccess.map((row) => row.estimatedCostUsd), 0.95) : null;
  const photoP95 = canMeasure ? percentile(photoSuccess.map((row) => row.estimatedCostUsd), 0.95) : null;
  const projection = recipeP95 === null || photoP95 === null ? null
    : Math.round((60 * recipeP95 + 30 * photoP95) * manifest.usdKrw * 100) / 100;
  const sufficient = recipeSuccess.length >= 50 && photoSuccess.length >= 30;
  const costStatus = !sufficient || projection === null ? "incomplete" : projection <= 858 ? "passed" : "failed";
  return {
    mode: "current-model-baseline", complete: issues.length === 0, issues,
    runtimeSource: manifest.runtimeSource, createdAt: manifest.createdAt, budgetUsd: manifest.budgetUsd,
    models: { recipe: manifest.recipe.model, photo: manifest.photo.model },
    total: metrics(results), recipe: metrics(recipe), photo: metrics(photo),
    scenes: { receipt: metrics(photo.filter((row) => row.scene === "receipt")), fridge: metrics(photo.filter((row) => row.scene === "fridge")) },
    policy: { formula: "60 * recipe p95 + 30 * photo p95", population: "successful requests, including their repair costs",
      recipeP95CostUsd: recipeP95, photoP95CostUsd: photoP95,
      usdKrw: manifest.usdKrw, budgetKrw: 858, projectedMonthlyCostKrw: projection, status: costStatus },
    adoptionEvaluated: false, salesPolicyChanged: false,
  };
}
