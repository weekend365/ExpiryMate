import { getNonNegativeIntegerEnv } from "./number-env";

/** One operation budget includes all semantic repairs. SDK retries are disabled. */
export class OpenAiRequestBudget {
  private readonly deadline: number;
  private readonly requestTimeoutMs: number;

  constructor(feature: "RECIPE_AI" | "INVENTORY_PHOTO_PARSE", now = Date.now()) {
    const recipe = feature === "RECIPE_AI";
    this.deadline = now + positiveEnv(`${feature}_DEADLINE_MS`, recipe ? 60_000 : 45_000);
    this.requestTimeoutMs = positiveEnv(`${feature}_REQUEST_TIMEOUT_MS`, recipe ? 45_000 : 30_000);
  }

  async run<T>(request: (options: { timeout: number; maxRetries: number; signal: AbortSignal }) => PromiseLike<T>): Promise<T> {
    const remaining = this.deadline - Date.now();
    if (remaining <= 0) throw new Error("AI operation deadline exceeded.");
    const timeout = Math.min(this.requestTimeoutMs, remaining);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await request({ timeout, maxRetries: 0, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

function positiveEnv(name: string, fallback: number) {
  return getNonNegativeIntegerEnv(name, fallback) || fallback;
}
