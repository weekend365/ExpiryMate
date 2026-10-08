import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiRequestBudget } from "./openai-request-budget";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("AI operation deadlines", () => {
  it("disables SDK retry multiplication and shrinks the repair timeout", async () => {
    vi.useFakeTimers();
    const budget = new OpenAiRequestBudget("RECIPE_AI");
    const options = vi.fn(async (value: { timeout: number; maxRetries: number }) => value);
    expect(await budget.run(options)).toMatchObject({ timeout: 45000, maxRetries: 0 });
    vi.advanceTimersByTime(50000);
    expect(await budget.run(options)).toMatchObject({ timeout: 10000 });
    vi.advanceTimersByTime(10000);
    await expect(budget.run(options)).rejects.toThrow(/deadline/);
    expect(options).toHaveBeenCalledTimes(2);
  });
  it("aborts a pending photo request and releases its timer", async () => {
    vi.useFakeTimers();
    const budget = new OpenAiRequestBudget("INVENTORY_PHOTO_PARSE");
    const pending = budget.run(({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const assertion = expect(pending).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
