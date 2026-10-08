import { z } from "zod";

/** Accounting confidence, separate from generation success and user quota. */
export const aiUsageStatusSchema = z.enum([
  "reported",
  "estimated",
  "unavailable",
  "partial",
  "legacy",
]);
export type AiUsageStatus = z.infer<typeof aiUsageStatusSchema>;

const tokenCount = z.number().int().nonnegative().safe();

/** Validate only provider token telemetry; never persist the raw provider response. */
export const openAiResponseUsageSchema = z.object({
  input_tokens: tokenCount,
  input_tokens_details: z.object({
    cached_tokens: tokenCount,
    cache_write_tokens: tokenCount.optional(),
  }),
  output_tokens: tokenCount,
  output_tokens_details: z.object({ reasoning_tokens: tokenCount }).optional(),
  total_tokens: tokenCount,
}).superRefine((usage, context) => {
  if (usage.input_tokens_details.cached_tokens +
      (usage.input_tokens_details.cache_write_tokens ?? 0) > usage.input_tokens) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Cached input exceeds total input tokens." });
  }
  if (usage.total_tokens !== usage.input_tokens + usage.output_tokens) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Token totals do not match." });
  }
  if ((usage.output_tokens_details?.reasoning_tokens ?? 0) > usage.output_tokens) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Reasoning exceeds output tokens." });
  }
});

const nullableMetric = z.number().finite().nonnegative().nullable();
export const adminAiMetricsGroupSchema = z.object({
  feature: z.enum(["recipe", "photo"]),
  scene: z.string().nullable(),
  model: z.string(),
  promptVersion: z.string(),
  variant: z.string(),
  pricingVersion: z.string(),
  requestClass: z.enum(["simple", "complex", "photo", "legacy"]),
  requests: tokenCount,
  successes: tokenCount,
  failures: tokenCount,
  repairs: tokenCount,
  successRate: z.number().min(0).max(1),
  firstPassSuccessRate: z.number().min(0).max(1),
  usageStatusCounts: z.record(aiUsageStatusSchema, tokenCount),
  knownCostUsd: z.number().nonnegative(),
  failedKnownCostUsd: z.number().nonnegative(),
  costPerSuccessUsd: nullableMetric,
  meanRequestCostUsd: nullableMetric,
  p95RequestCostUsd: nullableMetric,
  p50DurationMs: nullableMetric,
  p95DurationMs: nullableMetric,
  cachedInputRatio: nullableMetric,
  cacheWriteInputRatio: nullableMetric,
});
export const adminAiMetricsSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  truncated: z.boolean(),
  sampleLimitPerFeature: tokenCount,
  groups: z.array(adminAiMetricsGroupSchema),
});
export type AdminAiMetricsGroup = z.infer<typeof adminAiMetricsGroupSchema>;
export type AdminAiMetrics = z.infer<typeof adminAiMetricsSchema>;
