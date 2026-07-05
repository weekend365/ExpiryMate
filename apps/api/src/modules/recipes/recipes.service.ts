import { createHash } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  ProductCategory,
  type RecipeRecommendation as PrismaRecipeRecommendation,
} from "@prisma/client";
import type {
  RecipeInventorySnapshotItem,
  RecipeRecommendation,
  RecipeRecommendationDish,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import {
  calculateDaysLeftUntilExpiry,
  dateOnlyToUtcDate,
  recipeInventorySnapshotItemSchema,
  recipeRecommendationRequestSchema,
  recipeRecommendationsPayloadSchema,
  toKstDateOnly,
} from "@expirymate/shared";
import OpenAI from "openai";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { PrismaService } from "../../database/prisma.service";
import { PrivacyService } from "../privacy/privacy.service";
import { CreateRecipeRecommendationDto } from "./dto/create-recipe-recommendation.dto";

const PROMPT_VERSION = "recipe-recommendation-v1";
const DEFAULT_MODEL = "gpt-5-mini";
const MAX_INGREDIENTS = 30;

const DEFAULT_RATE_LIMIT_MAX = 3;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const DEFAULT_DAILY_QUOTA = 20;
const DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_DAILY_COST_LIMIT_USD = 1;
const DEFAULT_MAX_OUTPUT_TOKENS = 2500;

interface RecipeRecommendationUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface RecipeRecommendationGeneration {
  recommendations: RecipeRecommendationDish[];
  usage: RecipeRecommendationUsage;
  estimatedCostUsd: number;
}

interface ModelPricing {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

const FALLBACK_MODEL_PRICING: ModelPricing = {
  inputUsdPerMillion: 0.25,
  cachedInputUsdPerMillion: 0.025,
  outputUsdPerMillion: 2,
};

const MODEL_PRICING_BY_PREFIX: Array<[string, ModelPricing]> = [
  ["gpt-5.4-mini", { inputUsdPerMillion: 0.75, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 4.5 }],
  ["gpt-5.4-nano", { inputUsdPerMillion: 0.2, cachedInputUsdPerMillion: 0.02, outputUsdPerMillion: 1.2 }],
  ["gpt-5.4", { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.25, outputUsdPerMillion: 20 }],
  ["gpt-5-mini", FALLBACK_MODEL_PRICING],
  ["gpt-5-nano", { inputUsdPerMillion: 0.05, cachedInputUsdPerMillion: 0.005, outputUsdPerMillion: 0.4 }],
  ["gpt-5", { inputUsdPerMillion: 1.25, cachedInputUsdPerMillion: 0.125, outputUsdPerMillion: 10 }],
  ["gpt-4.1-mini", { inputUsdPerMillion: 0.4, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 1.6 }],
  ["gpt-4.1-nano", { inputUsdPerMillion: 0.1, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 0.4 }],
  ["gpt-4.1", { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.5, outputUsdPerMillion: 8 }],
  ["gpt-4o-mini", { inputUsdPerMillion: 0.15, cachedInputUsdPerMillion: 0.075, outputUsdPerMillion: 0.6 }],
  ["gpt-4o", { inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 1.25, outputUsdPerMillion: 10 }],
];

const nonFoodCategories = new Set<ProductCategory>([
  ProductCategory.personal_care,
  ProductCategory.paper_goods,
  ProductCategory.cleaning,
  ProductCategory.household,
]);

@Injectable()
export class RecipesService {
  private readonly rateLimitHitsByOwner = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyService: PrivacyService,
  ) {}

  async createRecommendation(ownerKey: string, dto: CreateRecipeRecommendationDto) {
    const now = new Date();

    this.enforceRateLimit(ownerKey, now);
    await this.privacyService.ensureAiDataNoticeAccepted(ownerKey);

    const request = recipeRecommendationRequestSchema.parse({
      servings: dto.servings ?? 2,
      maxCookingMinutes: dto.maxCookingMinutes ?? 30,
      mealType: dto.mealType ?? "any",
      useExpiringFirst: dto.useExpiringFirst ?? true,
    });

    const inventorySnapshot = await this.buildInventorySnapshot(ownerKey, request);

    if (inventorySnapshot.length === 0) {
      throw new BadRequestException("추천 가능한 재료가 없습니다.");
    }

    const model = this.getModel();
    const requestCacheKey = buildRequestCacheKey(
      model,
      request,
      inventorySnapshot,
    );
    const cachedRecord = await this.findCachedRecommendation(
      ownerKey,
      requestCacheKey,
      now,
    );

    if (cachedRecord) {
      return this.serializeRecommendation(cachedRecord);
    }

    await this.enforceDailyQuota(ownerKey, now);
    await this.enforceDailyCostLimit(ownerKey, request, inventorySnapshot, now);

    const generation = await this.generateRecommendations(
      ownerKey,
      request,
      inventorySnapshot,
    );

    const record = await this.prisma.recipeRecommendation.create({
      data: {
        ownerKey,
        requestCacheKey,
        request: toJson(request),
        inventorySnapshot: toJson(inventorySnapshot),
        recommendations: toJson(generation.recommendations),
        aiProvider: "openai",
        aiModel: model,
        promptVersion: PROMPT_VERSION,
        inputTokens: generation.usage.inputTokens,
        cachedInputTokens: generation.usage.cachedInputTokens,
        outputTokens: generation.usage.outputTokens,
        totalTokens: generation.usage.totalTokens,
        estimatedCostUsd: toCostDecimal(generation.estimatedCostUsd),
      },
    });

    return this.serializeRecommendation(record);
  }

  async listRecommendations(ownerKey: string) {
    const records = await this.prisma.recipeRecommendation.findMany({
      where: { ownerKey },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return records.map((record) => this.serializeRecommendation(record));
  }

  async getRecommendation(id: string, ownerKey: string) {
    const record = await this.prisma.recipeRecommendation.findUnique({
      where: { id },
    });

    if (!record || record.ownerKey !== ownerKey) {
      throw new NotFoundException("추천 결과를 찾을 수 없습니다.");
    }

    return this.serializeRecommendation(record);
  }

  private enforceRateLimit(ownerKey: string, now: Date) {
    const maxRequests = getNonNegativeIntegerEnv(
      "RECIPE_RATE_LIMIT_MAX",
      DEFAULT_RATE_LIMIT_MAX,
    );
    const windowSeconds = getNonNegativeIntegerEnv(
      "RECIPE_RATE_LIMIT_WINDOW_SECONDS",
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    );

    if (maxRequests === 0 || windowSeconds === 0) {
      return;
    }

    const nowMs = now.getTime();
    const cutoffMs = nowMs - windowSeconds * 1000;
    const hits = (this.rateLimitHitsByOwner.get(ownerKey) ?? []).filter(
      (timestamp) => timestamp > cutoffMs,
    );

    if (hits.length >= maxRequests) {
      throw new HttpException(
        "추천 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    hits.push(nowMs);
    this.rateLimitHitsByOwner.set(ownerKey, hits);
  }

  private async enforceDailyQuota(ownerKey: string, now: Date) {
    const dailyQuota = getNonNegativeIntegerEnv(
      "RECIPE_DAILY_QUOTA",
      DEFAULT_DAILY_QUOTA,
    );

    if (dailyQuota === 0) {
      return;
    }

    const usedToday = await this.prisma.recipeRecommendation.count({
      where: {
        ownerKey,
        aiProvider: "openai",
        createdAt: {
          gte: startOfDay(now),
        },
      },
    });

    if (usedToday >= dailyQuota) {
      throw new HttpException(
        "오늘의 추천 생성 한도를 모두 사용했습니다.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async enforceDailyCostLimit(
    ownerKey: string,
    request: RecipeRecommendationRequest,
    inventorySnapshot: RecipeInventorySnapshotItem[],
    now: Date,
  ) {
    const dailyCostLimitUsd = getNonNegativeNumberEnv(
      "RECIPE_DAILY_COST_LIMIT_USD",
      DEFAULT_DAILY_COST_LIMIT_USD,
    );

    if (dailyCostLimitUsd === 0) {
      return;
    }

    const aggregate = await this.prisma.recipeRecommendation.aggregate({
      _sum: {
        estimatedCostUsd: true,
      },
      where: {
        ownerKey,
        aiProvider: "openai",
        createdAt: {
          gte: startOfDay(now),
        },
      },
    });
    const spentToday = decimalToNumber(aggregate._sum.estimatedCostUsd);
    const projectedCost = estimateGenerationCostUsd(
      request,
      inventorySnapshot,
      this.getModel(),
    );

    if (spentToday + projectedCost > dailyCostLimitUsd) {
      throw new HttpException(
        "오늘의 추천 생성 예산을 모두 사용했습니다.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async findCachedRecommendation(
    ownerKey: string,
    requestCacheKey: string,
    now: Date,
  ) {
    const cacheTtlSeconds = getNonNegativeIntegerEnv(
      "RECIPE_CACHE_TTL_SECONDS",
      DEFAULT_CACHE_TTL_SECONDS,
    );

    if (cacheTtlSeconds === 0) {
      return null;
    }

    return this.prisma.recipeRecommendation.findFirst({
      where: {
        ownerKey,
        requestCacheKey,
        createdAt: {
          gte: new Date(now.getTime() - cacheTtlSeconds * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private async buildInventorySnapshot(
    ownerKey: string,
    request: RecipeRecommendationRequest,
  ): Promise<RecipeInventorySnapshotItem[]> {
    const today = toKstDateOnly(new Date());
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        ownerKey,
        status: "active",
        expiryDate: {
          gte: dateOnlyToUtcDate(today),
        },
        OR: [
          {
            category: null,
          },
          {
            category: {
              notIn: Array.from(nonFoodCategories),
            },
          },
        ],
      },
      orderBy: request.useExpiringFirst
        ? [{ expiryDate: "asc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
      take: MAX_INGREDIENTS,
    });

    return items.map((item) => ({
      inventoryItemId: item.id,
      name: item.displayName,
      category: item.category as RecipeInventorySnapshotItem["category"],
      quantity: item.quantity,
      unit: item.unit,
      storageLocation:
        item.storageLocation as RecipeInventorySnapshotItem["storageLocation"],
      expiryDate: toKstDateOnly(item.expiryDate),
      daysUntilExpiry: calculateDaysLeftUntilExpiry(item.expiryDate, today),
    }));
  }

  private async generateRecommendations(
    ownerKey: string,
    request: RecipeRecommendationRequest,
    inventorySnapshot: RecipeInventorySnapshotItem[],
  ): Promise<RecipeRecommendationGeneration> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API 키가 설정되지 않았습니다.");
    }

    const model = this.getModel();
    const instructions = buildInstructions();
    const input = buildInput(request, inventorySnapshot);
    const client = new OpenAI({ apiKey });

    try {
      const response = await client.responses.parse({
        model,
        instructions,
        input,
        max_output_tokens: getNonNegativeIntegerEnv(
          "RECIPE_AI_MAX_OUTPUT_TOKENS",
          DEFAULT_MAX_OUTPUT_TOKENS,
        ),
        prompt_cache_key: buildOpenAIPromptCacheKey(ownerKey),
        safety_identifier: hashValue(ownerKey),
        metadata: {
          feature: "recipe_recommendation",
          promptVersion: PROMPT_VERSION,
        },
        text: {
          format: zodTextFormat(
            recipeRecommendationsPayloadSchema,
            "recipe_recommendations",
          ),
          verbosity: "low",
        },
      });

      const parsed = response.output_parsed;

      if (!parsed) {
        throw new Error("OpenAI response did not include parsed output.");
      }

      const recommendations =
        recipeRecommendationsPayloadSchema.parse(parsed).recommendations;
      const usage = normalizeUsage(response.usage, instructions, input, parsed);

      return {
        recommendations,
        usage,
        estimatedCostUsd: calculateCostUsd(usage, getModelPricing(model)),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new BadGatewayException("요리 추천을 생성하지 못했습니다.");
    }
  }

  private serializeRecommendation(
    record: PrismaRecipeRecommendation,
  ): RecipeRecommendation {
    const request = recipeRecommendationRequestSchema.parse(record.request);
    const inventorySnapshot = recipeInventorySnapshotItemSchema
      .array()
      .parse(record.inventorySnapshot);
    const recommendations = recipeRecommendationsPayloadSchema
      .shape.recommendations.parse(record.recommendations);

    return {
      id: record.id,
      ownerKey: record.ownerKey,
      createdAt: record.createdAt.toISOString(),
      request,
      inventorySnapshot,
      recommendations,
    };
  }

  private getModel() {
    return process.env.RECIPE_AI_MODEL ?? DEFAULT_MODEL;
  }
}

function buildInstructions() {
  return [
    "당신은 한국어로 답하는 실용적인 가정식 요리 추천 엔진입니다.",
    "사용자의 보관 재료만 주요 재료로 사용해 추천 요리 3개를 만드세요.",
    "만료된 재료는 입력되지 않으며, 유통기한이 가까운 재료를 우선 활용하세요.",
    "카테고리가 없는 재료는 실제 식재료로 확실할 때만 사용하세요.",
    "부족한 재료는 선택 재료로만 제안하고, 없어도 조리가 가능한 방향을 선호하세요.",
    "의학적 효능, 치료, 다이어트 효과를 주장하지 마세요.",
    "각 추천에는 재료 상태와 냄새를 확인하라는 짧은 안전 문구를 포함하세요.",
  ].join("\n");
}

function buildInput(
  request: RecipeRecommendationRequest,
  inventorySnapshot: RecipeInventorySnapshotItem[],
) {
  return JSON.stringify(
    {
      request,
      inventory: inventorySnapshot,
      outputRules: {
        language: "ko",
        count: 3,
        maxCookingMinutes: request.maxCookingMinutes,
        servings: request.servings,
        mealType: request.mealType,
      },
    },
    null,
    2,
  );
}

function buildRequestCacheKey(
  model: string,
  request: RecipeRecommendationRequest,
  inventorySnapshot: RecipeInventorySnapshotItem[],
) {
  return hashValue(
    stableStringify({
      model,
      promptVersion: PROMPT_VERSION,
      request,
      inventorySnapshot,
    }),
  );
}

function buildOpenAIPromptCacheKey(ownerKey: string) {
  return `recipe:${hashValue(ownerKey).slice(0, 48)}`;
}

function estimateGenerationCostUsd(
  request: RecipeRecommendationRequest,
  inventorySnapshot: RecipeInventorySnapshotItem[],
  model: string,
) {
  const usage: RecipeRecommendationUsage = {
    inputTokens: estimateTokenCount(
      `${buildInstructions()}\n${buildInput(request, inventorySnapshot)}`,
    ),
    cachedInputTokens: 0,
    outputTokens: getNonNegativeIntegerEnv(
      "RECIPE_AI_MAX_OUTPUT_TOKENS",
      DEFAULT_MAX_OUTPUT_TOKENS,
    ),
    totalTokens: 0,
  };
  usage.totalTokens = usage.inputTokens + usage.outputTokens;

  return calculateCostUsd(usage, getModelPricing(model));
}

function normalizeUsage(
  usage: ResponseUsage | undefined,
  instructions: string,
  input: string,
  parsed: unknown,
): RecipeRecommendationUsage {
  const inputTokens =
    usage?.input_tokens ?? estimateTokenCount(`${instructions}\n${input}`);
  const cachedInputTokens = Math.min(
    usage?.input_tokens_details.cached_tokens ?? 0,
    inputTokens,
  );
  const outputTokens =
    usage?.output_tokens ?? estimateTokenCount(stableStringify(parsed));
  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    inputTokens: normalizeTokenCount(inputTokens),
    cachedInputTokens: normalizeTokenCount(cachedInputTokens),
    outputTokens: normalizeTokenCount(outputTokens),
    totalTokens: normalizeTokenCount(totalTokens),
  };
}

function calculateCostUsd(
  usage: RecipeRecommendationUsage,
  pricing: ModelPricing,
) {
  const uncachedInputTokens = Math.max(
    usage.inputTokens - usage.cachedInputTokens,
    0,
  );
  const cost =
    (uncachedInputTokens * pricing.inputUsdPerMillion +
      usage.cachedInputTokens * pricing.cachedInputUsdPerMillion +
      usage.outputTokens * pricing.outputUsdPerMillion) /
    1_000_000;

  return roundCost(cost);
}

function getModelPricing(model: string): ModelPricing {
  const basePricing = resolveModelPricing(model);

  return {
    inputUsdPerMillion: getNonNegativeNumberEnv(
      "RECIPE_AI_INPUT_COST_PER_1M_TOKENS",
      basePricing.inputUsdPerMillion,
    ),
    cachedInputUsdPerMillion: getNonNegativeNumberEnv(
      "RECIPE_AI_CACHED_INPUT_COST_PER_1M_TOKENS",
      basePricing.cachedInputUsdPerMillion,
    ),
    outputUsdPerMillion: getNonNegativeNumberEnv(
      "RECIPE_AI_OUTPUT_COST_PER_1M_TOKENS",
      basePricing.outputUsdPerMillion,
    ),
  };
}

function resolveModelPricing(model: string) {
  const match = MODEL_PRICING_BY_PREFIX.find(
    ([prefix]) => model === prefix || model.startsWith(`${prefix}-`),
  );

  return match ? match[1] : FALLBACK_MODEL_PRICING;
}

function startOfDay(date = new Date()) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 2));
}

function normalizeTokenCount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function getNonNegativeIntegerEnv(name: string, fallback: number) {
  return Math.floor(getNonNegativeNumberEnv(name, fallback));
}

function getNonNegativeNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return value;
}

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value.toNumber();
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function toCostDecimal(value: number) {
  return new Prisma.Decimal(roundCost(value).toFixed(6));
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortForStableStringify(value)) ?? "";
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableStringify);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const object = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(object).sort()) {
      const item = object[key];

      if (item !== undefined) {
        sorted[key] = sortForStableStringify(item);
      }
    }

    return sorted;
  }

  return value;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
