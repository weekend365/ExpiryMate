import { readFileSync } from "node:fs";
import { evaluationResultSchema, evaluationGradeSchema, type AiEvaluationResult as Result, type AiEvaluationGrade as Grade } from "@expirymate/shared";
export { evaluationResultSchema } from "@expirymate/shared";

/** Missing grades, mismatched cohorts and unknown charges cannot pass adoption. */
export function evaluateAdoption(results: Result[], grades: Grade[], controlModel: string) {
  const gradeMap = new Map(grades.map(grade => [key(grade), grade]));
  if (gradeMap.size !== grades.length || new Set(results.map(key)).size !== results.length) throw new Error("Duplicate result or grade.");
  const cohorts = new Map<string, Result[]>();
  for (const result of results) {
    const cohort = JSON.stringify([result.datasetHash, result.feature, result.scene, result.promptVersion, result.pricingVersion]);
    const rows = cohorts.get(cohort) ?? []; rows.push(result); cohorts.set(cohort, rows);
  }
  return [...cohorts.values()].flatMap(rows => {
    const control = rows.filter(row => row.model === controlModel);
    return [...new Set(rows.map(row => row.model))].filter(model => model !== controlModel).map(model => {
      const candidate = rows.filter(row => row.model === model);
      const issues: string[] = [];
      const paired = control.length > 0 && JSON.stringify(control.map(pairKey).sort()) === JSON.stringify(candidate.map(pairKey).sort());
      if (!paired) issues.push("unmatched_cases");
      for (const group of [control, candidate]) {
        const expectedCases = rows[0]!.feature === "recipe" ? 200 : 100;
        const expectedRepeats = rows[0]!.feature === "recipe" ? 3 : 2;
        const caseIds = new Set(group.map(row => row.caseId));
        if (caseIds.size < expectedCases || [...caseIds].some(id => new Set(group.filter(row => row.caseId === id).map(row => row.repeat)).size < expectedRepeats)) issues.push("insufficient_samples");
        if (group.some(row => row.usage.usageStatus !== "reported")) issues.push("incomplete_accounting");
        const successes = group.filter(row => row.status === "succeeded");
        if (successes.some(row => !gradeMap.has(key(row)))) issues.push("missing_quality_grades");
        if (successes.some(row => gradeMap.get(key(row))?.safetyPassed === false)) issues.push("safety_failure");
      }
      const baseline = metrics(control, gradeMap);
      const proposed = metrics(candidate, gradeMap);
      if (baseline.costPerSuccessUsd === null || proposed.costPerSuccessUsd === null || baseline.costPerSuccessUsd <= 0) issues.push("cost_target_unverified");
      else if (proposed.costPerSuccessUsd > baseline.costPerSuccessUsd * 0.70) issues.push("cost_target_not_met");
      if (proposed.successRate < baseline.successRate - 0.01 - 1e-9) issues.push("success_regression");
      if (proposed.quality === null || baseline.quality === null) issues.push("quality_not_evaluated");
      else if (proposed.quality < baseline.quality - 0.02 - 1e-9) issues.push("quality_regression");
      if (proposed.p95DurationMs === null || baseline.p95DurationMs === null) issues.push("latency_unverified");
      else if (proposed.p95DurationMs > baseline.p95DurationMs * 1.10) issues.push("latency_regression");
      return { feature: rows[0]!.feature, scene: rows[0]!.scene, datasetHash: rows[0]!.datasetHash, model, controlModel,
        passed: issues.length === 0, issues: [...new Set(issues)], control: baseline, candidate: proposed };
    });
  });
}

function metrics(rows: Result[], grades: Map<string, Grade>) {
  const successes = rows.filter(row => row.status === "succeeded");
  const quality = successes.flatMap(row => { const grade = grades.get(key(row)); return grade ? [grade.quality] : []; });
  const durations = rows.map(row => row.durationMs).sort((a, b) => a - b);
  return { requests: rows.length, successes: successes.length, successRate: rows.length ? successes.length / rows.length : 0,
    costPerSuccessUsd: successes.length && rows.every(row => row.usage.usageStatus === "reported") ? rows.reduce((sum, row) => sum + row.estimatedCostUsd, 0) / successes.length : null,
    quality: quality.length === successes.length && quality.length ? quality.reduce((sum, value) => sum + value, 0) / quality.length : null,
    p95DurationMs: durations[Math.ceil(durations.length * 0.95) - 1] ?? null };
}
function key(row: { caseId: string; datasetHash: string; model: string; repeat: number }) { return JSON.stringify([row.datasetHash, row.caseId, row.model, row.repeat]); }
function pairKey(row: Result) { return JSON.stringify([row.caseId, row.repeat]); }
function lines(path: string) { return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as unknown); }

if (require.main === module) {
  const [resultsFile, gradesFile, control] = process.argv.slice(2);
  if (!resultsFile || !gradesFile || !control) throw new Error("Usage: ai-evaluation-report.ts results.jsonl grades.jsonl control-model");
  const report = evaluateAdoption(lines(resultsFile).map(row => evaluationResultSchema.parse(row)), lines(gradesFile).map(row => evaluationGradeSchema.parse(row)), control);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  if (!report.length || report.some(item => !item.passed)) process.exitCode = 1;
}
