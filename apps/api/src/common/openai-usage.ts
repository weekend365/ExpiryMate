import {
  openAiResponseUsageSchema,
  type AiUsageStatus,
} from "@expirymate/shared";
import { hasOpenAiCacheWritePricing, type OpenAiTokenUsage } from "./openai-model-config";

export interface OpenAiUsage extends OpenAiTokenUsage {
  cacheWriteInputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number;
  usageStatus: AiUsageStatus;
}

export function emptyOpenAiUsage(): OpenAiUsage {
  return { inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0,
    outputTokens: 0, reasoningTokens: 0, totalTokens: 0, usageStatus: "reported" };
}

/** Unknown/unvalidated data cannot become reported cost by type assertion. */
export function normalizeOpenAiUsage(
  raw: unknown,
  model: string,
  estimate?: { inputTokens: number; outputTokens: number },
): OpenAiUsage {
  const parsed = openAiResponseUsageSchema.safeParse(raw);
  const writesApply = hasOpenAiCacheWritePricing(model);
  if (parsed.success) {
    const usage = parsed.data;
    const writeTokens = usage.input_tokens_details.cache_write_tokens;
    return {
      inputTokens: usage.input_tokens,
      cachedInputTokens: usage.input_tokens_details.cached_tokens,
      cacheWriteInputTokens: writeTokens ?? (writesApply ? null : 0),
      outputTokens: usage.output_tokens,
      reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? null,
      totalTokens: usage.total_tokens,
      usageStatus: writeTokens === undefined && writesApply ? "estimated" : "reported",
    };
  }
  if (estimate && Number.isSafeInteger(estimate.inputTokens) && estimate.inputTokens >= 0 &&
      Number.isSafeInteger(estimate.outputTokens) && estimate.outputTokens >= 0 &&
      Number.isSafeInteger(estimate.inputTokens + estimate.outputTokens)) {
    return {
      ...emptyOpenAiUsage(), ...estimate,
      cacheWriteInputTokens: writesApply ? null : 0,
      reasoningTokens: null,
      totalTokens: estimate.inputTokens + estimate.outputTokens,
      usageStatus: "estimated",
    };
  }
  return { ...emptyOpenAiUsage(), cacheWriteInputTokens: null, reasoningTokens: null, usageStatus: "unavailable" };
}

export function combineOpenAiUsage(first: OpenAiUsage, second: OpenAiUsage): OpenAiUsage {
  const states = [first.usageStatus, second.usageStatus];
  const known = first.totalTokens > 0 || second.totalTokens > 0;
  const status: AiUsageStatus = states.includes("partial") || states.includes("unavailable")
    ? (known ? "partial" : "unavailable")
    : states.includes("legacy") ? "legacy" : states.includes("estimated") ? "estimated" : "reported";
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    cachedInputTokens: first.cachedInputTokens + second.cachedInputTokens,
    cacheWriteInputTokens: nullableSum(first.cacheWriteInputTokens, second.cacheWriteInputTokens),
    outputTokens: first.outputTokens + second.outputTokens,
    reasoningTokens: nullableSum(first.reasoningTokens, second.reasoningTokens),
    totalTokens: first.totalTokens + second.totalTokens,
    usageStatus: status,
  };
}

function nullableSum(first: number | null, second: number | null) {
  return first === null || second === null ? null : first + second;
}
