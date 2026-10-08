import { describe, expect, it } from "vitest";
import { buildAiMetrics, type AiMetricRow } from "./admin-ai-metrics";

const row: AiMetricRow = { feature: "recipe", scene: null, aiModel: "gpt-6-luna", promptVersion: "v1", variant: "candidate", pricingVersion: "test", requestClass: "simple", status: "succeeded", usageStatus: "reported", estimatedCostUsd: 0.001, generationAttempts: 1, durationMs: 100, inputTokens: 100, cachedInputTokens: 10, cacheWriteInputTokens: 50 };
describe("admin AI accounting", () => {
  it("includes failed requests in cost per valid completion and repair rates", () => {
    expect(buildAiMetrics([row, { ...row, status: "failed", generationAttempts: 3, estimatedCostUsd: 0.003, durationMs: 900 }])[0]).toMatchObject({ requests: 2, successes: 1, failures: 1, repairs: 1, successRate: 0.5, firstPassSuccessRate: 0.5, costPerSuccessUsd: 0.004, failedKnownCostUsd: 0.003, p50DurationMs: 100, p95DurationMs: 900, cacheWriteInputRatio: 0.5 });
  });
  it("marks unknown-charge averages unavailable and keeps the known lower bound", () => {
    expect(buildAiMetrics([row, { ...row, status: "failed", usageStatus: "unavailable", estimatedCostUsd: 0 }])[0]).toMatchObject({ costPerSuccessUsd: null, meanRequestCostUsd: null, knownCostUsd: 0.001, usageStatusCounts: { unavailable: 1 } });
  });
  it("separates scene, model, variant and pricing versions", () => {
    expect(buildAiMetrics([row, { ...row, pricingVersion: "new" }, { ...row, feature: "photo", scene: "receipt" }, { ...row, variant: "control" }])).toHaveLength(4);
    expect(buildAiMetrics([])).toEqual([]);
    expect(buildAiMetrics([{ ...row, status: "failed" }])[0]?.costPerSuccessUsd).toBeNull();
  });
});
