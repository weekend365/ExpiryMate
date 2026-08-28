export interface OpenAiModelPricing {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface OpenAiTokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

const MODEL_PRICING_BY_PREFIX: Array<[string, OpenAiModelPricing]> = [
  [
    "gpt-5.6-terra",
    {
      inputUsdPerMillion: 2,
      cachedInputUsdPerMillion: 0.2,
      outputUsdPerMillion: 12,
    },
  ],
  [
    "gpt-5.6-luna",
    {
      inputUsdPerMillion: 0.2,
      cachedInputUsdPerMillion: 0.02,
      outputUsdPerMillion: 1.2,
    },
  ],
  [
    "gpt-5.4-mini",
    {
      inputUsdPerMillion: 0.75,
      cachedInputUsdPerMillion: 0.075,
      outputUsdPerMillion: 4.5,
    },
  ],
  [
    "gpt-5.4-nano",
    {
      inputUsdPerMillion: 0.2,
      cachedInputUsdPerMillion: 0.02,
      outputUsdPerMillion: 1.2,
    },
  ],
  [
    "gpt-5.4",
    {
      inputUsdPerMillion: 2.5,
      cachedInputUsdPerMillion: 0.25,
      outputUsdPerMillion: 20,
    },
  ],
  [
    "gpt-5-mini",
    {
      inputUsdPerMillion: 0.25,
      cachedInputUsdPerMillion: 0.025,
      outputUsdPerMillion: 2,
    },
  ],
  [
    "gpt-5-nano",
    {
      inputUsdPerMillion: 0.05,
      cachedInputUsdPerMillion: 0.005,
      outputUsdPerMillion: 0.4,
    },
  ],
  [
    "gpt-5",
    {
      inputUsdPerMillion: 1.25,
      cachedInputUsdPerMillion: 0.125,
      outputUsdPerMillion: 10,
    },
  ],
  [
    "gpt-4.1-mini",
    {
      inputUsdPerMillion: 0.4,
      cachedInputUsdPerMillion: 0.1,
      outputUsdPerMillion: 1.6,
    },
  ],
  [
    "gpt-4.1-nano",
    {
      inputUsdPerMillion: 0.1,
      cachedInputUsdPerMillion: 0.025,
      outputUsdPerMillion: 0.4,
    },
  ],
  [
    "gpt-4.1",
    {
      inputUsdPerMillion: 2,
      cachedInputUsdPerMillion: 0.5,
      outputUsdPerMillion: 8,
    },
  ],
  [
    "gpt-4o-mini",
    {
      inputUsdPerMillion: 0.15,
      cachedInputUsdPerMillion: 0.075,
      outputUsdPerMillion: 0.6,
    },
  ],
  [
    "gpt-4o",
    {
      inputUsdPerMillion: 2.5,
      cachedInputUsdPerMillion: 1.25,
      outputUsdPerMillion: 10,
    },
  ],
];

export function getOpenAiModelPricing(model: string): OpenAiModelPricing {
  const normalized = model.trim();
  const match = MODEL_PRICING_BY_PREFIX.find(
    ([prefix]) => normalized === prefix || normalized.startsWith(`${prefix}-`),
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
  const uncachedInputTokens = Math.max(
    usage.inputTokens - usage.cachedInputTokens,
    0,
  );
  const cost =
    (uncachedInputTokens * pricing.inputUsdPerMillion +
      usage.cachedInputTokens * pricing.cachedInputUsdPerMillion +
      usage.outputTokens * pricing.outputUsdPerMillion) /
    1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function getOpenAiReasoning(model: string) {
  return model.trim().startsWith("gpt-5")
    ? ({ effort: "none" } as const)
    : undefined;
}

export function isKnownOpenAiModel(model: string) {
  try {
    getOpenAiModelPricing(model);
    return true;
  } catch {
    return false;
  }
}
