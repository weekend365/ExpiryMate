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
  "RECIPE_AI_CANDIDATE_MODEL",
  "RECIPE_AI_CANDIDATE_PERCENT",
  "RECIPE_AI_ENABLED",
  "RECIPE_RATE_LIMIT_MAX",
  "RECIPE_RATE_LIMIT_WINDOW_SECONDS",
  "RECIPE_DAILY_COST_LIMIT_USD",
  "RECIPE_GLOBAL_DAILY_COST_LIMIT_USD",
  "RECIPE_MAX_INFLIGHT",
  "RECIPE_AI_MAX_OUTPUT_TOKENS",
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

  it("returns the existing result for a completed Idempotency-Key", async () => {
    const { prisma, service, monetizationService } = createService();
    monetizationService.getCompletedRecommendationId.mockResolvedValue(
      cachedRecord.id,
    );
    prisma.recipeRecommendation.findUnique.mockResolvedValue(cachedRecord);

    const result = await service.createRecommendation(
      "owner-a",
      request,
      undefined,
      "retry-key",
    );
    expect(result.id).toBe("cached-recommendation");
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    expect(monetizationService.reserveRecommendation).not.toHaveBeenCalled();
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("rate limits repeated user actions even with different idempotency keys", async () => {
    process.env.RECIPE_RATE_LIMIT_MAX = "1";
    process.env.RECIPE_RATE_LIMIT_WINDOW_SECONDS = "60";
    const { prisma, service } = createService();
    vi.spyOn(
      service as TestableRecipesService,
      "generateRecommendations",
    ).mockResolvedValue({
      recommendations,
      usage: {
        inputTokens: 10,
        cachedInputTokens: 0,
        outputTokens: 20,
        totalTokens: 30,
      },
      estimatedCostUsd: 0.000043,
    });
    prisma.recipeRecommendation.create.mockResolvedValue(cachedRecord);

    await service.createRecommendation("owner-a", request, undefined, "key-1");

    await expectTooManyRequests(
      service.createRecommendation("owner-a", request, undefined, "key-2"),
    );
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledTimes(2);
  });

  it("releases a reserved recommendation when generation fails", async () => {
    const { service, monetizationService } = createService();
    vi.spyOn(
      service as TestableRecipesService,
      "generateRecommendations",
    ).mockRejectedValue(new Error("upstream failed"));

    await expect(
      service.createRecommendation("owner-a", request, undefined, "key-fail"),
    ).rejects.toThrow("upstream failed");
    expect(monetizationService.releaseRecommendation).toHaveBeenCalledWith(
      "usage-1",
      "Error",
    );
  });

  it("blocks new generations when the projected daily cost exceeds the cap", async () => {
    process.env.RECIPE_DAILY_COST_LIMIT_USD = "0.001";
    process.env.RECIPE_AI_MAX_OUTPUT_TOKENS = "2500";
    const { prisma, service } = createService();

    await expect(
      service.createRecommendation("owner-a", request),
    ).rejects.toMatchObject({
      errorCode: "RECIPE_DAILY_BUDGET_EXHAUSTED",
    });
    expect(prisma.recipeAiGenerationEvent.aggregate).toHaveBeenCalled();
    expect(prisma.recipeRecommendation.create).not.toHaveBeenCalled();
  });

  it("blocks new generations when the global daily cost budget is exhausted", async () => {
    process.env.RECIPE_DAILY_COST_LIMIT_USD = "0";
    process.env.RECIPE_GLOBAL_DAILY_COST_LIMIT_USD = "0.001";
    process.env.RECIPE_AI_MAX_OUTPUT_TOKENS = "2500";
    const { prisma, service } = createService();
    prisma.recipeAiGenerationEvent.aggregate.mockResolvedValue({
      _sum: { estimatedCostUsd: "0.001" },
    });

    await expectTooManyRequests(service.createRecommendation("owner-a", request));
    expect(prisma.recipeAiGenerationEvent.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
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

  it("uses one candidate selection for generation, cost, and transactional persistence", async () => {
    process.env.RECIPE_DAILY_COST_LIMIT_USD = "0";
    process.env.RECIPE_AI_CANDIDATE_MODEL = "gpt-5.6-terra";
    process.env.RECIPE_AI_CANDIDATE_PERCENT = "100";
    const { prisma, service } = createService();
    const generation: RecipeRecommendationGeneration = {
      recommendations,
      usage: {
        inputTokens: 1000,
        cachedInputTokens: 100,
        outputTokens: 500,
        totalTokens: 1500,
      },
      estimatedCostUsd: 0.00782,
    };
    const generateSpy = vi.spyOn(
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
    expect(generateSpy).toHaveBeenCalledWith(
      "owner-a",
      request,
      expect.any(Array),
      expect.any(Object),
      expect.any(Object),
      { model: "gpt-5.6-terra", variant: "candidate" },
      undefined,
    );
    expect(createPayload?.data).toMatchObject({
      promptVersion: "recipe-recommendation-v5",
      aiModel: "gpt-5.6-terra",
      inputTokens: 1000,
      cachedInputTokens: 100,
      outputTokens: 500,
      totalTokens: 1500,
    });
    expect(String(createPayload?.data.estimatedCostUsd)).toBe("0.00782");
    expect(createPayload?.data.requestCacheKey).toBeNull();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.recipeAiGenerationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recommendationId: "generated-recommendation",
          aiModel: "gpt-5.6-terra",
          variant: "candidate",
          status: "succeeded",
        }),
      }),
    );
  });
});

describe("RecipesService favorites", () => {
  beforeEach(() => {
    restoreManagedEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreManagedEnv();
  });

  it("saves an owned dish snapshot with an idempotent upsert", async () => {
    const { prisma, service } = createService();
    prisma.recipeRecommendation.findUnique.mockResolvedValue(cachedRecord);
    prisma.recipeFavorite.upsert.mockImplementation(
      async ({ create }: { create: Record<string, unknown> }) => ({
        id: "favorite-1",
        ...create,
        createdAt: new Date("2099-06-08T00:00:00.000Z"),
      }),
    );

    const result = await service.saveFavorite(
      "cached-recommendation",
      1,
      "owner-a",
    );

    expect(result.dish.title).toBe("계란 요리 2");
    expect(prisma.recipeFavorite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerKey_sourceRecommendationId_sourceDishIndex: {
            ownerKey: "owner-a",
            sourceRecommendationId: "cached-recommendation",
            sourceDishIndex: 1,
          },
        },
      }),
    );
    expect(prisma.recipeDishEngagement.upsert).toHaveBeenCalled();
  });

  it("rejects an out-of-range dish index", async () => {
    const { prisma, service } = createService();
    prisma.recipeRecommendation.findUnique.mockResolvedValue(cachedRecord);

    await expect(
      service.saveFavorite("cached-recommendation", 5, "owner-a"),
    ).rejects.toThrow("즐겨찾기할 요리를 찾을 수 없습니다.");
    expect(prisma.recipeFavorite.upsert).not.toHaveBeenCalled();
  });

  it("does not expose another owner's recommendation", async () => {
    const { prisma, service } = createService();
    prisma.recipeRecommendation.findUnique.mockResolvedValue(cachedRecord);

    await expect(
      service.saveFavorite("cached-recommendation", 0, "owner-b"),
    ).rejects.toThrow("추천 결과를 찾을 수 없습니다.");
    expect(prisma.recipeFavorite.upsert).not.toHaveBeenCalled();
  });

  it("removes a favorite idempotently within the current owner", async () => {
    const { prisma, service } = createService();

    await expect(
      service.deleteFavorite("recommendation-1", 2, "owner-a"),
    ).resolves.toEqual({ ok: true });
    expect(prisma.recipeFavorite.deleteMany).toHaveBeenCalledWith({
      where: {
        ownerKey: "owner-a",
        sourceRecommendationId: "recommendation-1",
        sourceDishIndex: 2,
      },
    });
    expect(prisma.recipeDishEngagement.updateMany).toHaveBeenCalledWith({
      where: {
        ownerKey: "owner-a",
        recommendationId: "recommendation-1",
        dishIndex: 2,
      },
      data: { favoritedAt: null },
    });
  });

  it("records and undoes a dish dismissal idempotently", async () => {
    const { prisma, service } = createService();
    prisma.recipeRecommendation.findUnique.mockResolvedValue(cachedRecord);
    const updatedAt = new Date("2099-06-08T00:00:00.000Z");
    prisma.recipeDishEngagement.findUnique.mockResolvedValue({
      recommendationId: cachedRecord.id,
      dishIndex: 1,
      viewedAt: null,
      cookingStartedAt: null,
      cookingCompletedAt: null,
      dismissedAt: null,
      favoritedAt: null,
      updatedAt,
    });

    await service.recordEngagement(
      cachedRecord.id,
      1,
      "undo_dismiss",
      "owner-a",
    );

    expect(prisma.recipeDishEngagement.upsert).not.toHaveBeenCalled();
  });
});

function createService() {
  const prisma = {
    inventoryItem: {
      findMany: vi.fn().mockResolvedValue([inventoryItem]),
    },
    recipeRecommendation: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({
        _sum: {
          estimatedCostUsd: "0",
        },
      }),
      create: vi.fn(),
    },
    recipeAiGenerationEvent: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { estimatedCostUsd: "0" },
      }),
      create: vi.fn().mockResolvedValue({ id: "generation-event" }),
    },
    recipeFavorite: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    recipeDishEngagement: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
  );
  const privacyService = {
    ensureAiDataNoticeAccepted: vi.fn().mockResolvedValue(undefined),
  };
  const settingsService = {
    getRecipePreferences: vi.fn().mockResolvedValue({
      allergens: [],
      excludedIngredients: [],
      dietaryStyle: "any",
      maxSpiceLevel: "any",
      availableEquipment: ["stovetop"],
      updatedAt: "2099-06-01T00:00:00.000Z",
    }),
  };
  const monetizationService = {
    getCompletedRecommendationId: vi.fn().mockResolvedValue(null),
    reserveRecommendation: vi
      .fn()
      .mockResolvedValue({ kind: "reserved", usageEventId: "usage-1" }),
    completeRecommendation: vi.fn().mockResolvedValue(undefined),
    releaseRecommendation: vi.fn().mockResolvedValue(undefined),
  };

  return {
    prisma,
    privacyService,
    monetizationService,
    service: new RecipesService(
      prisma as never,
      privacyService as never,
      new RecipePolicyService(prisma as never),
      monetizationService as never,
      settingsService as never,
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
