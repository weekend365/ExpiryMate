import { describe, expect, it } from "vitest";
import { combineOpenAiUsage, emptyOpenAiUsage, normalizeOpenAiUsage } from "./openai-usage";

const raw = { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 30, total_tokens: 130 };
describe("AI usage confidence", () => {
  it("distinguishes older reported usage and missing newer cache-write details", () => {
    expect(normalizeOpenAiUsage(raw, "gpt-4.1-mini")).toMatchObject({ usageStatus: "reported", cacheWriteInputTokens: 0 });
    expect(normalizeOpenAiUsage(raw, "gpt-6-luna")).toMatchObject({ usageStatus: "estimated", cacheWriteInputTokens: null });
    expect(normalizeOpenAiUsage({ ...raw, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 80 } }, "gpt-6-luna")).toMatchObject({ usageStatus: "reported", cacheWriteInputTokens: 80 });
  });
  it("never labels an unknown provider charge as reported zero", () => {
    expect(normalizeOpenAiUsage(undefined, "gpt-6-luna").usageStatus).toBe("unavailable");
    expect(emptyOpenAiUsage().usageStatus).toBe("reported");
    expect(normalizeOpenAiUsage({ ...raw, total_tokens: 1 }, "gpt-6-luna").usageStatus).toBe("unavailable");
  });
  it("keeps missing-charge repairs partial and sums reported attempts", () => {
    const reported = normalizeOpenAiUsage(raw, "gpt-4.1-mini");
    expect(combineOpenAiUsage(reported, normalizeOpenAiUsage(undefined, "gpt-4.1-mini"))).toMatchObject({ usageStatus: "partial", totalTokens: 130 });
    expect(combineOpenAiUsage(reported, reported)).toMatchObject({ usageStatus: "reported", totalTokens: 260 });
  });
  it("uses an explicit estimate and rejects invalid estimates", () => {
    expect(normalizeOpenAiUsage(undefined, "gpt-6-luna", { inputTokens: 1200, outputTokens: 400 })).toMatchObject({ usageStatus: "estimated", totalTokens: 1600 });
    expect(normalizeOpenAiUsage(undefined, "gpt-6-luna", { inputTokens: -1, outputTokens: 400 }).usageStatus).toBe("unavailable");
  });
});
