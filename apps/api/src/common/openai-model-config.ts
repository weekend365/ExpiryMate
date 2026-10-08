export const OPENAI_PRICING_VERSION = "openai-standard-2026-10-08";

export interface OpenAiModelPricing {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  cacheWriteInputUsdPerMillion: number;
  outputUsdPerMillion: number;
  longContextThreshold?: number;
}

export interface OpenAiTokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  /** null means the provider did not report cache-write accounting. */
  cacheWriteInputTokens?: number | null;
  outputTokens: number;
}

const MODEL_PRICING_BY_PREFIX: Array<[string, OpenAiModelPricing]> = [
  [
    "gpt-6.1-sol",
    {
      inputUsdPerMillion: 2,
      cachedInputUsdPerMillion: 0.1,
      cacheWriteInputUsdPerMillion: 2.5,
      outputUsdPerMillion: 10,
      longContextThreshold: 272_000,
    },
  ],
  [
    "gpt-6-luna",
    {
      inputUsdPerMillion: 0.1,
      cachedInputUsdPerMillion: 0.01,
      cacheWriteInputUsdPerMillion: 0.125,
      outputUsdPerMillion: 0.5,
      longContextThreshold: 272_000,
    },
  ],
  [
    "gpt-5.6-terra",
    {
      inputUsdPerMillion: 2,
      cachedInputUsdPerMillion: 0.2,
      cacheWriteInputUsdPerMillion: 2.5,
      outputUsdPerMillion: 12,
    },
  ],
  [
    "gpt-5.6-luna",
    {
      inputUsdPerMillion: 0.2,
      cachedInputUsdPerMillion: 0.02,
      cacheWriteInputUsdPerMillion: 0.25,
      outputUsdPerMillion: 1.2,
    },
  ],
  [
    "gpt-5.4-mini",
    {
      inputUsdPerMillion: 0.75,
      cachedInputUsdPerMillion: 0.075,
      cacheWriteInputUsdPerMillion: 0.75,
      outputUsdPerMillion: 4.5,
    },
  ],
  [
    "gpt-5.4-nano",
    {
      inputUsdPerMillion: 0.2,
      cachedInputUsdPerMillion: 0.02,
      cacheWriteInputUsdPerMillion: 0.2,
      outputUsdPerMillion: 1.2,
    },
  ],
  [
    "gpt-5.4",
    {
      inputUsdPerMillion: 2.5,
      cachedInputUsdPerMillion: 0.25,
      cacheWriteInputUsdPerMillion: 2.5,
      outputUsdPerMillion: 20,
    },
  ],
  [
    "gpt-5-mini",
    {
      inputUsdPerMillion: 0.25,
      cachedInputUsdPerMillion: 0.025,
      cacheWriteInputUsdPerMillion: 0.25,
      outputUsdPerMillion: 2,
    },
  ],
  [
    "gpt-5-nano",
    {
      inputUsdPerMillion: 0.05,
      cachedInputUsdPerMillion: 0.005,
      cacheWriteInputUsdPerMillion: 0.05,
      outputUsdPerMillion: 0.4,
    },
  ],
  [
    "gpt-5",
    {
      inputUsdPerMillion: 1.25,
      cachedInputUsdPerMillion: 0.125,
      cacheWriteInputUsdPerMillion: 1.25,
      outputUsdPerMillion: 10,
    },
  ],
  [
    "gpt-4.1-mini",
    {
      inputUsdPerMillion: 0.4,
      cachedInputUsdPerMillion: 0.1,
      cacheWriteInputUsdPerMillion: 0.4,
      outputUsdPerMillion: 1.6,
    },
  ],
  [
    "gpt-4.1-nano",
    {
      inputUsdPerMillion: 0.1,
      cachedInputUsdPerMillion: 0.025,
      cacheWriteInputUsdPerMillion: 0.1,
      outputUsdPerMillion: 0.4,
    },
  ],
  [
    "gpt-4.1",
    {
      inputUsdPerMillion: 2,
      cachedInputUsdPerMillion: 0.5,
      cacheWriteInputUsdPerMillion: 2,
      outputUsdPerMillion: 8,
    },
  ],
  [
    "gpt-4o-mini",
    {
      inputUsdPerMillion: 0.15,
      cachedInputUsdPerMillion: 0.075,
      cacheWriteInputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    },
  ],
  [
    "gpt-4o",
    {
      inputUsdPerMillion: 2.5,
      cachedInputUsdPerMillion: 1.25,
      cacheWriteInputUsdPerMillion: 2.5,
      outputUsdPerMillion: 10,
    },
  ],
];

export function getOpenAiModelPricing(model: string): OpenAiModelPricing {
  const normalized = model.trim();
  const match = MODEL_PRICING_BY_PREFIX.find(
    ([prefix]) => matchesModel(normalized, prefix),
  );

  if (!match) {
    throw new Error(`Unsupported OpenAI model pricing: ${normalized || "empty"}`);
  }

  return match[1];
}

export function calculateOpenAiCostUsd(
  usage: OpenAiTokenUsage,
  model: string,
) {
  const pricing = getOpenAiModelPricing(model);
  const inputTokens = validTokenCount(usage.inputTokens);
  const cachedInputTokens = Math.min(validTokenCount(usage.cachedInputTokens), inputTokens);
  const remainingInputTokens = inputTokens - cachedInputTokens;
  // Missing write details on a newer model are conservatively estimated, never
  // described as a precisely reported zero. The usage status records uncertainty.
  const cacheWriteInputTokens = Math.min(
    usage.cacheWriteInputTokens === null
      ? remainingInputTokens
      : validTokenCount(usage.cacheWriteInputTokens ?? 0),
    remainingInputTokens,
  );
  const uncachedInputTokens = remainingInputTokens - cacheWriteInputTokens;
  const longContext = pricing.longContextThreshold !== undefined && inputTokens > pricing.longContextThreshold;
  const cost =
    ((uncachedInputTokens * pricing.inputUsdPerMillion +
      cachedInputTokens * pricing.cachedInputUsdPerMillion +
      cacheWriteInputTokens * pricing.cacheWriteInputUsdPerMillion) * (longContext ? 2 : 1) +
      validTokenCount(usage.outputTokens) * pricing.outputUsdPerMillion * (longContext ? 1.5 : 1)) /
    1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function getOpenAiReasoning(model: string) {
  const name = model.trim();
  if (matchesModel(name, "gpt-6.1-sol")) return { effort: "low" } as const;
  if (matchesModel(name, "gpt-6-luna") ||
      ["gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.4"].some(prefix => matchesModel(name, prefix))) {
    return { effort: "none" } as const;
  }
  if (["gpt-5-mini", "gpt-5-nano", "gpt-5"].some(prefix => matchesModel(name, prefix))) {
    return { effort: "minimal" } as const;
  }
  return undefined;
}

export function hasOpenAiCacheWritePricing(model: string) {
  const pricing = getOpenAiModelPricing(model);
  return pricing.cacheWriteInputUsdPerMillion > pricing.inputUsdPerMillion;
}

/** GPT-4.x rejects verbosity; Structured Outputs still works without it. */
export function getOpenAiTextOptions(model: string) {
  return getOpenAiReasoning(model) ? { verbosity: "low" as const } : {};
}

function matchesModel(model: string, prefix: string) {
  return model === prefix || new RegExp(`^${prefix.replaceAll(".", "\\.")}-\\d{4}-\\d{2}-\\d{2}$`).test(model);
}

function validTokenCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid OpenAI token count.");
  return value;
}

export function isKnownOpenAiModel(model: string) {
  try {
    getOpenAiModelPricing(model);
    return true;
  } catch {
    return false;
  }
}
