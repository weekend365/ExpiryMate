import { adminAiMetricsGroupSchema, type AdminAiMetricsGroup, type AiUsageStatus } from "@expirymate/shared";

export interface AiMetricRow {
  feature: "recipe" | "photo";
  scene: string | null;
  aiModel: string;
  promptVersion: string;
  variant: string;
  pricingVersion: string;
  requestClass: "simple" | "complex" | "photo" | "legacy";
  status: string;
  usageStatus: string;
  estimatedCostUsd: { toString(): string } | number;
  generationAttempts: number;
  durationMs: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number | null;
}

/** Unknown charges never enter a mean as exact zero. Failure cost is included. */
export function buildAiMetrics(rows: AiMetricRow[]): AdminAiMetricsGroup[] {
  const groups = new Map<string, AiMetricRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.feature, row.scene, row.aiModel, row.promptVersion, row.variant, row.pricingVersion, row.requestClass]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const first = group[0]!;
    const counts: Record<AiUsageStatus, number> = { reported: 0, estimated: 0, unavailable: 0, partial: 0, legacy: 0 };
    for (const row of group) counts[Object.hasOwn(counts, row.usageStatus) ? row.usageStatus as AiUsageStatus : "unavailable"]++;
    const accounted = group.filter(row => row.usageStatus === "reported" || row.usageStatus === "estimated");
    const knownCost = group.filter(row => row.usageStatus !== "unavailable").reduce((sum, row) => sum + Number(row.estimatedCostUsd), 0);
    const successes = group.filter(row => row.status === "succeeded").length;
    const completeAccounting = accounted.length === group.length;
    const input = accounted.reduce((sum, row) => sum + row.inputTokens, 0);
    const writesKnown = accounted.every(row => row.cacheWriteInputTokens !== null);
    return adminAiMetricsGroupSchema.parse({
      feature: first.feature, scene: first.scene, model: first.aiModel, promptVersion: first.promptVersion,
      variant: first.variant, pricingVersion: first.pricingVersion, requestClass: first.requestClass, requests: group.length, successes,
      failures: group.length - successes, repairs: group.filter(row => row.generationAttempts > 1).length,
      successRate: successes / group.length,
      firstPassSuccessRate: group.filter(row => row.status === "succeeded" && row.generationAttempts === 1).length / group.length,
      usageStatusCounts: counts, knownCostUsd: round(knownCost),
      failedKnownCostUsd: round(group.filter(row => row.status === "failed" && row.usageStatus !== "unavailable").reduce((sum, row) => sum + Number(row.estimatedCostUsd), 0)),
      costPerSuccessUsd: completeAccounting && successes ? round(knownCost / successes) : null,
      meanRequestCostUsd: completeAccounting ? round(knownCost / group.length) : null,
      p95RequestCostUsd: completeAccounting ? percentile(accounted.map(row => Number(row.estimatedCostUsd)), 0.95) : null,
      p50DurationMs: percentile(group.flatMap(row => row.durationMs === null ? [] : [row.durationMs]), 0.5),
      p95DurationMs: percentile(group.flatMap(row => row.durationMs === null ? [] : [row.durationMs]), 0.95),
      cachedInputRatio: input ? accounted.reduce((sum, row) => sum + row.cachedInputTokens, 0) / input : null,
      cacheWriteInputRatio: input && writesKnown ? accounted.reduce((sum, row) => sum + (row.cacheWriteInputTokens ?? 0), 0) / input : null,
    });
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function round(value: number) { return Math.round(value * 1_000_000) / 1_000_000; }
function percentile(values: number[], rank: number) {
  if (!values.length) return null;
  return values.sort((a, b) => a - b)[Math.ceil(values.length * rank) - 1] ?? null;
}
