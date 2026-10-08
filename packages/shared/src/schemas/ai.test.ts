import { describe, expect, it } from "vitest";
import { openAiResponseUsageSchema } from "./ai";

const usage = { input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 50 }, output_tokens: 30, output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 130 };
describe("AI provider usage contract", () => {
  it("accepts inclusive cache-write accounting and strips unrelated data", () => {
    expect(openAiResponseUsageSchema.parse({ ...usage, raw_prompt: "private" })).toEqual(usage);
  });
  it.each([
    { ...usage, input_tokens: -1 },
    { ...usage, total_tokens: 129 },
    { ...usage, input_tokens_details: { cached_tokens: 60, cache_write_tokens: 41 } },
    { ...usage, output_tokens_details: { reasoning_tokens: 31 } },
    { ...usage, input_tokens: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects inconsistent or unsafe counts", invalid => {
    expect(openAiResponseUsageSchema.safeParse(invalid).success).toBe(false);
  });
});
