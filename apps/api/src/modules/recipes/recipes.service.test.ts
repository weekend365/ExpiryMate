import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecipePolicyService } from "./recipe-policy.service";
import { RecipesService } from "./recipes.service";

const managedEnvKeys = [
  "OPENAI_API_KEY",
  "RECIPE_AI_MODEL",
  "RECIPE_AI_ENABLED",
  "RECIPE_RATE_LIMIT_MAX",
  "RECIPE_RATE_LIMIT_WINDOW_SECONDS",
  "RECIPE_DAILY_QUOTA",
  "RECIPE_CACHE_TTL_SECONDS",
  "RECIPE_DAILY_COST_LIMIT_USD",
  "RECIPE_GLOBAL_DAILY_COST_LIMIT_USD",
  "RECIPE_MAX_INFLIGHT",
  "RECIPE_AI_MAX_OUTPUT_TOKENS",
  "RECIPE_AI_INPUT_COST_PER_1M_TOKENS",
  "RECIPE_AI_CACHED_INPUT_COST_PER_1M_TOKENS",
  "RECIPE_AI_OUTPUT_COST_PER_1M_TOKENS",
] as const;

const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]]),
);

const request = {
  servings: 2,
  maxCookingMinutes: 30,
  mealType: "any",
  useExpiringFirst: true,
} as const;

const inventoryItem = {
  id: "item-1",
  ownerKey: "owner-a",
  productId: null,
  displayName: "계란",
  brand: null,
  category: "egg",
  quantity: 2,
  unit: "개",
  quantityBase: 2,
  unitCode: "ea",
  storageLocation: "fridge",
  expiryDate: new Date("2099-06-10T00:00:00.000Z"),
  expirySource: "manual",
  status: "active",
  notes: null,
  createdAt: new Date("2099-06-01T00:00:00.000Z"),
  updatedAt: new Date("2099-06-01T00:00:00.000Z"),
};

const inventorySnapshot = [
  {
    inventoryItemId: "item-1",
    name: "계란",
    category: "egg",
    quantity: 2,
    unit: "개",
    quantityBase: 2,
    unitCode: "ea",
    storageLocation: "fridge",
    expiryDate: "2099-06-10",
    daysUntilExpiry: 3,
  },
];

const recommendations = [0, 1, 2].map((index) => ({
  title: `계란 요리 ${index + 1}`,
  summary: "빠르게 만들 수 있는 계란 요리입니다.",
  cookingTimeMinutes: 15,
  difficulty: "easy" as const,
  servings: 2,
  usedIngredients: [{ inventoryItemId: "item-1", name: "계란" }],
  optionalMissingIngredients: [],
  steps: ["재료 상태를 확인합니다.", "익혀서 완성합니다."],
  tips: ["간은 마지막에 맞추세요."],
  safetyNote: "조리 전 냄새와 상태를 확인하세요.",
}));

const cachedRecord = {
  id: "cached-recommendation",
  ownerKey: "owner-a",
  request,
  inventorySnapshot,
  recommendations,
  aiProvider: "openai",
  aiModel: "gpt-5.4-mini",
  promptVersion: "recipe-recommendation-v2",
  requestCacheKey: "cache-key",
  inputTokens: 10,
  cachedInputTokens: 0,
  outputTokens: 20,
  totalTokens: 30,
  estimatedCostUsd: "0.000043",
  createdAt: new Date("2099-06-07T00:00:00.000Z"),
};

type RecipeRecommendationGeneration = {
  recommendations: typeof recommendations;
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  estimatedCostUsd: number;
};

type TestableRecipesService = RecipesService & {
  generateRecommendations: (
    ownerKey: string,
    request: unknown,
    inventorySnapshot: unknown[],
  ) => Promise<RecipeRecommendationGeneration>;
};

describe("RecipesService recommendation guards", () => {
  beforeEach(() => {
    restoreManagedEnv();
    process.env.RECIPE_AI_MODEL = "gpt-5.4-mini";
    process.env.RECIPE_RATE_LIMIT_MAX = "0";
    process.env.RECIPE_GLOBAL_DAILY_COST_LIMIT_USD = "0";
    process.env.RECIPE_MAX_INFLIGHT = "0";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreManagedEnv();
  });

  it("returns a cached recommendation before requiring a new OpenAI call", async () => {
    const { prisma, service } = createService();
    prisma.recipeRecommendation.findFirst.mockResolvedValue(cachedRecord);

    const result = await service.createRecommendation("owner-a", request);

    expect(result.id).toBe("cached-recommendation");
    expect(prisma.recipeRecommendation.count).not.toHaveBeenCalled();
    expect(prisma.recipeRecommendation.aggregate).not.toHaveBeenCalled();
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("rate limits repeated API requests even when cache can answer", async () => {
    process.env.RECIPE_RATE_LIMIT_MAX = "1";
    process.env.RECIPE_RATE_LIMIT_WINDOW_SECONDS = "60";
    const { prisma, service } = createService();
    prisma.recipeRecommendation.findFirst.mockResolvedValue(cachedRecord);

    await service.createRecommendation("owner-a", request);

    await expectTooManyRequests(service.createRecommendation("owner-a", request));
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledTimes(1);
  });

  it("blocks new generations when the daily quota is exhausted", async () => {
    process.env.RECIPE_DAILY_QUOTA = "1";
    const { prisma, service } = createService();
    prisma.recipeRecommendation.count.mockResolvedValue(1);

    await expectTooManyRequests(service.createRecommendation("owner-a", request));
    expect(prisma.recipeRecommendation.aggregate).not.toHaveBeenCalled();
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("blocks new generations when the projected daily cost exceeds the cap", async () => {
    process.env.RECIPE_DAILY_QUOTA = "0";
    process.env.RECIPE_DAILY_COST_LIMIT_USD = "0.001";
    process.env.RECIPE_AI_MAX_OUTPUT_TOKENS = "2500";
    const { prisma, service } = createService();

    await expectTooManyRequests(service.createRecommendation("owner-a", request));
    expect(prisma.recipeRecommendation.aggregate).toHaveBeenCalled();
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("blocks new generations when the global daily cost budget is exhausted", async () => {
    process.env.RECIPE_DAILY_QUOTA = "0";
    process.env.RECIPE_DAILY_COST_LIMIT_USD = "0";
    process.env.RECIPE_GLOBAL_DAILY_COST_LIMIT_USD = "0.001";
    process.env.RECIPE_AI_MAX_OUTPUT_TOKENS = "2500";
    const { prisma, service } = createService();
    prisma.recipeRecommendation.aggregate.mockResolvedValue({
      _sum: { estimatedCostUsd: "0.001" },
    });

    await expectTooManyRequests(service.createRecommendation("owner-a", request));
    expect(prisma.recipeRecommendation.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          aiProvider: "openai",
        }),
      }),
    );
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("refuses generation when the AI kill switch is off", async () => {
    process.env.RECIPE_AI_ENABLED = "false";
    const { prisma, service } = createService();

    await expect(service.createRecommendation("owner-a", request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("stores usage and estimated cost metadata for new generations", async () => {
    process.env.RECIPE_DAILY_QUOTA = "0";
    process.env.RECIPE_DAILY_COST_LIMIT_USD = "0";
    const { prisma, service } = createService();
    const generation: RecipeRecommendationGeneration = {
      recommendations,
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 100,
        outputTokens: 500,
        totalTokens: 1500,
      },
      estimatedCostUsd: 0.001225,
    };
    vi.spyOn(
      service as TestableRecipesService,
      "generateRecommendations",
    ).mockResolvedValue(generation);
    prisma.recipeRecommendation.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "generated-recommendation",
        ownerKey: data.ownerKey,
        request: data.request,
        inventorySnapshot: data.inventorySnapshot,
        recommendations: data.recommendations,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        promptVersion: data.promptVersion,
        requestCacheKey: data.requestCacheKey,
        inputTokens: data.inputTokens,
        cachedInputTokens: data.cachedInputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        estimatedCostUsd: data.estimatedCostUsd,
        createdAt: new Date("2099-06-07T00:00:00.000Z"),
      }),
    );

    const result = await service.createRecommendation("owner-a", request);

    const createPayload = prisma.recipeRecommendation.create.mock.calls[0]?.[0];
    expect(result.id).toBe("generated-recommendation");
    expect(createPayload?.data).toMatchObject({
      promptVersion: "recipe-recommendation-v3",
      inputTokens: 1000,
      cachedInputTokens: 100,
      outputTokens: 500,
      totalTokens: 1500,
    });
    expect(String(createPayload?.data.estimatedCostUsd)).toBe("0.001225");
    expect(typeof createPayload?.data.requestCacheKey).toBe("string");
  });
});

function createService() {
  const prisma = {
    inventoryItem: {
      findMany: vi.fn().mockResolvedValue([inventoryItem]),
    },
    recipeRecommendation: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({
        _sum: {
          estimatedCostUsd: "0",
        },
      }),
      create: vi.fn(),
    },
  };
  const privacyService = {
    ensureAiDataNoticeAccepted: vi.fn().mockResolvedValue(undefined),
  };

  return {
    prisma,
    privacyService,
    service: new RecipesService(
      prisma as never,
      privacyService as never,
      new RecipePolicyService(prisma as never),
    ),
  };
}

async function expectTooManyRequests(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    return;
  }

  throw new Error("Expected request to be rejected with HTTP 429.");
}

function restoreManagedEnv() {
  for (const key of managedEnvKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
