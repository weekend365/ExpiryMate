import { describe, expect, it } from "vitest";
import {
  calculateOpenAiCostUsd,
  getOpenAiModelPricing,
  getOpenAiReasoning,
} from "./openai-model-config";

describe("OpenAI model configuration", () => {
  it("calculates the representative recipe prices", () => {
    const usage = {
      inputTokens: 2_000,
      cachedInputTokens: 0,
      outputTokens: 1_500,
    };

    expect(calculateOpenAiCostUsd(usage, "gpt-5.4-mini")).toBe(0.00825);
    expect(calculateOpenAiCostUsd(usage, "gpt-5.6-terra")).toBe(0.022);
  });

  it("calculates the representative photo prices", () => {
    const usage = {
      inputTokens: 1_200,
      cachedInputTokens: 0,
      outputTokens: 400,
    };

    expect(calculateOpenAiCostUsd(usage, "gpt-4.1-mini")).toBe(0.00112);
    expect(calculateOpenAiCostUsd(usage, "gpt-5.6-luna")).toBe(0.00072);
  });

  it("supports snapshots and rejects unpriced models", () => {
    expect(getOpenAiModelPricing("gpt-5.6-terra-2026-08-01")).toEqual(
      getOpenAiModelPricing("gpt-5.6-terra"),
    );
    expect(() => getOpenAiModelPricing("unknown-model")).toThrow(
      /Unsupported OpenAI model pricing/,
    );
  });

  it("only adds explicit reasoning to GPT-5 models", () => {
    expect(getOpenAiReasoning("gpt-5.6-luna")).toEqual({ effort: "none" });
    expect(getOpenAiReasoning("gpt-5.4-mini")).toEqual({ effort: "none" });
    expect(getOpenAiReasoning("gpt-4.1-mini")).toBeUndefined();
  });
});
