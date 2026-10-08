import { Prisma } from "@prisma/client";
import { OPENAI_PRICING_VERSION } from "./openai-model-config";
import type { OpenAiUsage } from "./openai-usage";

export interface AiAttempt {
  model: string;
  reasoningEffort: string;
  status: string;
  usage: OpenAiUsage;
  estimatedCostUsd: number;
  durationMs: number;
}

/** Persist accounting only: no prompt, response text, inventory, or image. */
export function serializeAiUsage(usage: OpenAiUsage) {
  return { ...usage, pricingVersion: OPENAI_PRICING_VERSION };
}

export function serializeAiAttempts(attempts: AiAttempt[]): Prisma.InputJsonValue {
  return attempts.map(attempt => ({ ...attempt, usage: { ...attempt.usage } }));
}
