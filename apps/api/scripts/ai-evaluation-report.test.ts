import { describe, expect, it } from "vitest";
import { evaluateAdoption, evaluationResultSchema } from "./ai-evaluation-report";

function fixture() {
  const results = Array.from({ length: 600 }, (_, index) => ["control", "candidate"].map(model => evaluationResultSchema.parse({ caseId: `case-${Math.floor(index / 3)}`, datasetHash: "synthetic-test-only", model, repeat: index % 3, feature: "recipe", scene: null, promptVersion: "test", pricingVersion: "test", status: "succeeded", durationMs: model === "control" ? 100 : 80, estimatedCostUsd: model === "control" ? 0.01 : 0.005, usage: { usageStatus: "reported" } }))).flat();
  const grades = results.map(row => ({ caseId: row.caseId, datasetHash: row.datasetHash, model: row.model, repeat: row.repeat, quality: 1, safetyPassed: true }));
  return { results, grades };
}
describe("model adoption gates", () => {
  it("passes only a fully paired, graded sample that meets the targets", () => {
    const { results, grades } = fixture();
    expect(evaluateAdoption(results, grades, "control")[0]?.passed).toBe(true);
  });
  it("rejects missing grades, unknown charge, safety failure and insufficient samples", () => {
    const { results, grades } = fixture();
    const ungraded = evaluateAdoption(results, [], "control")[0]!;
    expect(ungraded.issues).toContain("missing_quality_grades");
    expect(ungraded.issues).toContain("quality_not_evaluated");
    expect(ungraded.issues).not.toContain("quality_regression");
    results[0]!.usage.usageStatus = "unavailable";
    grades[1]!.safetyPassed = false;
    const report = evaluateAdoption(results, grades, "control")[0]!;
    expect(report.passed).toBe(false);
    expect(report.issues).toContain("safety_failure");
    expect(report.issues).toContain("incomplete_accounting");
    expect(report.issues).toContain("cost_target_unverified");
    expect(report.issues).not.toContain("cost_target_not_met");
    expect(evaluateAdoption(results.slice(0, 10), grades, "control")[0]?.issues).toContain("insufficient_samples");
  });
  it("rejects quality, latency and cost regressions even with complete inputs", () => {
    const { results, grades } = fixture();
    results.filter(row => row.model === "candidate").forEach(row => { row.estimatedCostUsd = 0.009; row.durationMs = 111; });
    grades.filter(row => row.model === "candidate").forEach(row => { row.quality = 0.97; });
    expect(evaluateAdoption(results, grades, "control")[0]?.issues).toEqual(expect.arrayContaining(["cost_target_not_met", "latency_regression", "quality_regression"]));
  });
});
