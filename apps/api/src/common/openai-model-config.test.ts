import { describe, expect, it } from "vitest";
import {
  calculateOpenAiCostUsd,
  getOpenAiModelPricing,
  getOpenAiReasoning,
  getOpenAiTextOptions,
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
    expect(() => getOpenAiModelPricing("gpt-5-pro")).toThrow(/Unsupported/);
    expect(() => getOpenAiModelPricing("gpt-6-luna-fast")).toThrow(/Unsupported/);
  });

  it("uses only reasoning efforts supported by each family", () => {
    expect(getOpenAiReasoning("gpt-6.1-sol")).toEqual({ effort: "low" });
    expect(getOpenAiReasoning("gpt-6-luna")).toEqual({ effort: "none" });
    expect(getOpenAiReasoning("gpt-5-mini")).toEqual({ effort: "minimal" });
    expect(getOpenAiReasoning("gpt-5.6-luna")).toEqual({ effort: "none" });
    expect(getOpenAiReasoning("gpt-5.4-mini")).toEqual({ effort: "none" });
    expect(getOpenAiReasoning("gpt-4.1-mini")).toBeUndefined();
  });

  it("omits unsupported verbosity on legacy text and vision models", () => {
    expect(getOpenAiTextOptions("gpt-4.1-mini")).toEqual({});
    expect(getOpenAiTextOptions("gpt-4o-mini")).toEqual({});
    expect(getOpenAiTextOptions("gpt-6-luna")).toEqual({ verbosity: "low" });
  });

  it("replaces regular input with cache-write pricing without double charging", () => {
    expect(calculateOpenAiCostUsd({ inputTokens: 100_000, cachedInputTokens: 20_000, cacheWriteInputTokens: 50_000, outputTokens: 10_000 }, "gpt-6-luna")).toBe(0.01445);
    expect(calculateOpenAiCostUsd({ inputTokens: 100_000, cachedInputTokens: 0, cacheWriteInputTokens: null, outputTokens: 0 }, "gpt-6-luna")).toBe(0.0125);
  });

  it("applies long-context premiums only above the boundary", () => {
    expect(calculateOpenAiCostUsd({ inputTokens: 272_000, cachedInputTokens: 0, outputTokens: 1000 }, "gpt-6-luna")).toBe(0.0277);
    expect(calculateOpenAiCostUsd({ inputTokens: 272_001, cachedInputTokens: 0, outputTokens: 1000 }, "gpt-6-luna")).toBe(0.05515);
  });

  it.each([-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid token counts (%s)", inputTokens => {
    expect(() => calculateOpenAiCostUsd({ inputTokens, cachedInputTokens: 0, outputTokens: 0 }, "gpt-6-luna")).toThrow(/Invalid/);
  });
});
