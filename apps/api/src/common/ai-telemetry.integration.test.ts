import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../database/prisma.service";
import { serializeAiAttempts, serializeAiUsage } from "./ai-telemetry";
import { normalizeOpenAiUsage } from "./openai-usage";
import { AdminMonetizationService } from "../modules/admin/admin-monetization.service";

const databaseUrl = process.env.JANGO_WORKFLOW_TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.startsWith("/jango_feature_test")) throw new Error("AI integration tests require an isolated jango_feature_test database.");

describe.skipIf(!databaseUrl)("AI accounting with PostgreSQL", () => {
  const db = new PrismaService({ datasourceUrl: databaseUrl });
  const ownerKey = `ai-accounting-${randomUUID()}`;
  const base = { ownerKey, aiModel: "gpt-6-luna", promptVersion: "integration", variant: "candidate", reasoningEffort: "none", status: "succeeded" };
  beforeAll(async () => { await db.user.create({ data: { id: ownerKey } }); });
  afterAll(async () => {
    await db.recipeRecommendation.deleteMany({ where: { ownerKey } });
    await db.user.deleteMany({ where: { id: ownerKey } });
    await db.$disconnect();
  });

  it("preserves legacy uncertainty and stores new token accounting and attempt models", async () => {
    const legacy = await db.recipeAiGenerationEvent.create({ data: base });
    expect(legacy).toMatchObject({ usageStatus: "legacy", cacheWriteInputTokens: null, reasoningTokens: null });
    const usage = normalizeOpenAiUsage({ input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 50 }, output_tokens: 30, output_tokens_details: { reasoning_tokens: 10 }, total_tokens: 130 }, "gpt-6-luna");
    const attempts = serializeAiAttempts([{ model: "gpt-6-luna", reasoningEffort: "none", status: "succeeded", usage, estimatedCostUsd: 0.000026, durationMs: 25 }]);
    const event = await db.recipeAiGenerationEvent.create({ data: { ...base, ...serializeAiUsage(usage), attempts, generationAttempts: 1, durationMs: 25, estimatedCostUsd: 0.000026 } });
    expect(event).toMatchObject({ usageStatus: "reported", cacheWriteInputTokens: 50, reasoningTokens: 10, attempts });
    const recommendation = await db.recipeRecommendation.create({ data: { ownerKey, aiProvider: "openai", aiModel: base.aiModel, promptVersion: base.promptVersion, request: {}, inventorySnapshot: [], recommendations: [], ...serializeAiUsage(usage) } });
    expect(recommendation.usageStatus).toBe("reported");
    await db.inventoryPhotoParseEvent.create({ data: { ownerKey, aiModel: base.aiModel, promptVersion: base.promptVersion, scene: "receipt", variant: "candidate", ...serializeAiUsage(usage), attempts, estimatedCostUsd: 0.000026 } });
    const report = await new AdminMonetizationService(db).getAiMetrics(7);
    expect(report.groups.some(group => group.feature === "photo" && group.scene === "receipt" && group.promptVersion === "integration")).toBe(true);
  });

  it("rejects negative counts and invalid confidence states in the database", async () => {
    await expect(db.recipeAiGenerationEvent.create({ data: { ...base, cacheWriteInputTokens: -1 } })).rejects.toThrow();
    await expect(db.inventoryPhotoParseEvent.create({ data: { ownerKey, aiModel: base.aiModel, promptVersion: "integration", scene: "fridge", usageStatus: "exact-zero" } })).rejects.toThrow();
  });
});
