import { describe, expect, it } from "vitest";
import { baselineGradeSchema, baselineManifestSchema, baselineResultSchema, evaluateBaseline } from "./ai-baseline-report";

function fixture() {
  const plan = (feature: "recipe" | "photo") => ({
    model: `${feature}-current`, datasetHash: `${feature}-frozen`, promptVersion: "v1", pricingVersion: "fixed",
    cases: Array.from({ length: feature === "recipe" ? 50 : 30 }, (_, i) => ({
      id: `${feature}-${i}`, scene: feature === "recipe" ? null : i < 15 ? "receipt" : "fridge",
    })),
  });
  const manifest = baselineManifestSchema.parse({
    version: 1, createdAt: "2026-10-20T00:00:00Z", runtimeSource: "test", budgetUsd: 5, usdKrw: 1400,
    runtime: {}, recipe: plan("recipe"), photo: plan("photo"),
  });
  const results = (["recipe", "photo"] as const).flatMap((feature) => manifest[feature].cases.map((item) => baselineResultSchema.parse({
    caseId: item.id, scene: item.scene, feature, datasetHash: manifest[feature].datasetHash,
    model: manifest[feature].model, promptVersion: "v1", pricingVersion: "fixed", repeat: 0,
    status: "succeeded", durationMs: 1000, estimatedCostUsd: feature === "recipe" ? 0.005 : 0.002,
    usage: { usageStatus: "reported" },
  })));
  const grades = results.map((row) => baselineGradeSchema.parse({ ...row, safetyPassed: true, quality: 0.9,
    ...(row.feature === "photo"
      ? { photoReview: { expectedItems: 2, omittedItems: 0, misidentifiedItems: 0, falsePositiveItems: 0, quantityErrors: 0, inventedDates: 0 } }
      : { recipeReview: { constraintChecks: 6, constraintViolations: 0 } }),
  }));
  return { manifest, results, grades };
}

describe("current-model baseline reporting", () => {
  it("reports one current model per feature without weakening adoption thresholds", () => {
    const { manifest, results, grades } = fixture();
    const report = evaluateBaseline(manifest, results, grades);
    expect(report).toMatchObject({ complete: true, adoptionEvaluated: false, salesPolicyChanged: false });
    expect(report.total).toMatchObject({ requests: 80, knownCostUsd: 0.31, accountingComplete: true, quality: 0.9 });
    expect(report.policy).toMatchObject({ recipeP95CostUsd: 0.005, photoP95CostUsd: 0.002,
      projectedMonthlyCostKrw: 504, status: "passed", budgetKrw: 858 });
    expect(report.scenes.receipt.requests).toBe(15);
  });

  it("includes failed/repair costs in the total and leaves insufficient successful samples incomplete", () => {
    const { manifest, results, grades } = fixture();
    results[0]!.status = "failed";
    results[0]!.estimatedCostUsd = 0.02;
    const report = evaluateBaseline(manifest, results, grades);
    expect(report.recipe.knownCostUsd).toBe(0.265);
    expect(report.recipe.costPerSuccessUsd).toBeCloseTo(0.265 / 49);
    expect(report.policy.status).toBe("incomplete");
    expect(report.issues).toContain("generation_failures");
  });

  it.each(["estimated", "unavailable", "partial", "legacy"] as const)("never turns %s usage into a confirmed cheap call", (status) => {
    const { manifest, results, grades } = fixture();
    results[0]!.usage.usageStatus = status;
    const report = evaluateBaseline(manifest, results, grades);
    expect(report.total.accountingComplete).toBe(false);
    expect(report.total.p95CostUsd).toBeNull();
    expect(report.total.costPerSuccessUsd).toBeNull();
    expect(report.policy.projectedMonthlyCostKrw).toBeNull();
    expect(report.policy.recipeP95CostUsd).toBeNull();
    expect(report.policy.photoP95CostUsd).toBeNull();
    expect(report.issues).toContain("incomplete_accounting");
  });

  it("keeps absent grades, unsafe outputs and partial runs unverified", () => {
    const { manifest, results, grades } = fixture();
    expect(evaluateBaseline(manifest, results, []).issues).toContain("missing_quality_grades");
    grades[0]!.safetyPassed = false;
    expect(evaluateBaseline(manifest, results, grades).issues).toContain("safety_failure");
    expect(evaluateBaseline(manifest, results.slice(0, 50), grades.slice(0, 50)).issues).toContain("incomplete_run");
  });

  it("reports reviewed omissions and constraint violations with explicit coverage", () => {
    const { manifest, results, grades } = fixture();
    grades[50]!.photoReview!.omittedItems = 1;
    grades[0]!.recipeReview!.constraintViolations = 1;
    const report = evaluateBaseline(manifest, results, grades);
    expect(report.photo.photoReview).toMatchObject({ reviewedRequests: 30, counts: { expectedItems: 60, omittedItems: 1 } });
    expect(report.recipe.recipeConstraintReview).toEqual({ reviewedRequests: 50, constraintChecks: 300, constraintViolations: 1 });
    delete grades[50]!.photoReview;
    delete grades[0]!.recipeReview;
    const partial = evaluateBaseline(manifest, results, grades);
    expect(partial.issues).toContain("missing_photo_review");
    expect(partial.issues).toContain("missing_recipe_constraint_review");
    expect(partial.photo.photoReview.reviewedRequests).toBe(29);
    expect(evaluateBaseline(manifest, results, []).photo.photoReview.counts).toBeNull();
    expect(() => baselineGradeSchema.parse({ ...grades[1], recipeReview: { constraintChecks: 1, constraintViolations: 2 } })).toThrow();
  });

  it("rejects duplicate results and grades or mixed models, prompts and datasets", () => {
    const { manifest, results, grades } = fixture();
    expect(() => evaluateBaseline(manifest, [...results, results[0]!], grades)).toThrow("Duplicate");
    expect(() => evaluateBaseline(manifest, results, [...grades, grades[0]!])).toThrow("Duplicate");
    for (const field of ["model", "datasetHash", "promptVersion", "pricingVersion"] as const) {
      expect(() => evaluateBaseline(manifest, [{ ...results[0]!, [field]: "different" }, ...results.slice(1)], [])).toThrow("cohort");
    }
  });

  it("reports the cost gate independently from completeness and enforces the shared budget", () => {
    const { manifest, results, grades } = fixture();
    for (const row of results) row.estimatedCostUsd = 0.1;
    const report = evaluateBaseline(manifest, results, grades);
    expect(report.policy.status).toBe("failed");
    expect(report.issues).toContain("budget_exceeded");
  });
});
