import { createHash } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  ProductCategory,
  type RecipeFavorite as PrismaRecipeFavorite,
  type RecipeRecommendation as PrismaRecipeRecommendation,
} from "@prisma/client";
import type {
  RecipeInventorySnapshotItem,
  RecipeFavorite,
  RecipeRecommendation,
  RecipeRecommendationDish,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import {
  calculateDaysLeftUntilExpiry,
  dateOnlyToUtcDate,
  generatedRecipeRecommendationsPayloadSchema,
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
import { RecipePolicyService } from "./recipe-policy.service";

const PROMPT_VERSION = "recipe-recommendation-v3";
const DEFAULT_MODEL = "gpt-5-mini";
const MAX_INGREDIENTS = 30;

const DEFAULT_CACHE_TTL_SECONDS = 6 * 60 * 60;
const DEFAULT_MAX_OUTPUT_TOKENS = 3500;

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
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyService: PrivacyService,
    private readonly recipePolicy: RecipePolicyService,
  ) {}

  async createRecommendation(
    ownerKey: string,
    request: RecipeRecommendationRequest,
    spaceId?: string,
  ) {
    const now = new Date();

    this.recipePolicy.ensureAiEnabled();
    this.recipePolicy.enforceRateLimit(ownerKey, now);
    await this.privacyService.ensureAiDataNoticeAccepted(ownerKey);

    const inventorySnapshot = await this.buildInventorySnapshot(
      ownerKey,
      request,
      spaceId,
    );

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
      spaceId,
    );

    if (cachedRecord) {
      return this.serializeRecommendation(cachedRecord);
    }

    const projectedCostUsd = estimateGenerationCostUsd(
      request,
      inventorySnapshot,
      model,
    );
    await this.recipePolicy.enforceDailyQuota(ownerKey, now);
    await this.recipePolicy.enforceDailyCostLimit(
      ownerKey,
      projectedCostUsd,
      now,
    );
    await this.recipePolicy.enforceGlobalDailyCostLimit(projectedCostUsd, now);

    const generation = await this.recipePolicy.withInflightLimit(() =>
      this.generateRecommendations(ownerKey, request, inventorySnapshot),
    );

    const record = await this.prisma.recipeRecommendation.create({
      data: {
        ownerKey,
        spaceId,
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

  async listRecommendations(ownerKey: string, spaceId?: string) {
    const records = await this.prisma.recipeRecommendation.findMany({
      where: recipeScope(ownerKey, spaceId),
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return records.map((record) => this.serializeRecommendation(record));
  }

  async getRecommendation(id: string, ownerKey: string, spaceId?: string) {
    const record = await this.prisma.recipeRecommendation.findUnique({
      where: { id },
    });

    if (
      !record ||
      (spaceId ? record.spaceId !== spaceId : record.ownerKey !== ownerKey)
    ) {
      throw new NotFoundException("추천 결과를 찾을 수 없습니다.");
    }

    return this.serializeRecommendation(record);
  }

  async listFavorites(ownerKey: string): Promise<RecipeFavorite[]> {
    const records = await this.prisma.recipeFavorite.findMany({
      where: { ownerKey },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => this.serializeFavorite(record));
  }

  async saveFavorite(
    recommendationId: string,
    dishIndex: number,
    ownerKey: string,
    spaceId?: string,
  ): Promise<RecipeFavorite> {
    const recommendation = await this.prisma.recipeRecommendation.findUnique({
      where: { id: recommendationId },
    });

    if (
      !recommendation ||
      (spaceId
        ? recommendation.spaceId !== spaceId
        : recommendation.ownerKey !== ownerKey)
    ) {
      throw new NotFoundException("추천 결과를 찾을 수 없습니다.");
    }

    const dishes = recipeRecommendationsPayloadSchema.shape.recommendations.parse(
      recommendation.recommendations,
    );
    const dish = dishes[dishIndex];

    if (!Number.isInteger(dishIndex) || dishIndex < 0 || !dish) {
      throw new BadRequestException("즐겨찾기할 요리를 찾을 수 없습니다.");
    }

    const inventorySnapshot = recipeInventorySnapshotItemSchema
      .array()
      .parse(recommendation.inventorySnapshot);
    const favorite = await this.prisma.recipeFavorite.upsert({
      where: {
        ownerKey_sourceRecommendationId_sourceDishIndex: {
          ownerKey,
          sourceRecommendationId: recommendationId,
          sourceDishIndex: dishIndex,
        },
      },
      create: {
        ownerKey,
        sourceRecommendationId: recommendationId,
        sourceDishIndex: dishIndex,
        dishSnapshot: toJson(dish),
        inventorySnapshot: toJson(inventorySnapshot),
      },
      update: {
        dishSnapshot: toJson(dish),
        inventorySnapshot: toJson(inventorySnapshot),
      },
    });

    return this.serializeFavorite(favorite);
  }

  async deleteFavorite(
    recommendationId: string,
    dishIndex: number,
    ownerKey: string,
  ) {
    await this.prisma.recipeFavorite.deleteMany({
      where: {
        ownerKey,
        sourceRecommendationId: recommendationId,
        sourceDishIndex: dishIndex,
      },
    });

    return { ok: true as const };
  }

  private async findCachedRecommendation(
    ownerKey: string,
    requestCacheKey: string,
    now: Date,
    spaceId?: string,
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
        ...recipeScope(ownerKey, spaceId),
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
    spaceId?: string,
  ): Promise<RecipeInventorySnapshotItem[]> {
    const today = toKstDateOnly(new Date());
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        ...(spaceId ? { spaceId } : { ownerKey }),
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
      quantityBase: item.quantityBase,
      unitCode: item.unitCode as RecipeInventorySnapshotItem["unitCode"],
      storageLocation:
        item.storageLocation,
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
            generatedRecipeRecommendationsPayloadSchema,
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
        generatedRecipeRecommendationsPayloadSchema.parse(parsed).recommendations;
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

      this.logger.error(
        "Recipe generation failed",
        error instanceof Error ? error.stack : String(error),
      );

      // Keep the user-facing copy conversational; include a short operator hint
      // when OpenAI rejects the configured model or credentials.
      const detail =
        error instanceof Error ? error.message.trim().slice(0, 160) : "";
      const looksLikeConfigIssue =
        /api key|invalid_api_key|model|does not exist|404|401|429/i.test(detail);

      throw new BadGatewayException(
        looksLikeConfigIssue
          ? "요리 추천 설정에 문제가 있어요. 잠시 후 다시 부탁하거나, 관리자에게 알려 주세요."
          : "요리 추천을 생성하지 못했습니다.",
      );
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
      spaceId: record.spaceId,
      createdAt: record.createdAt.toISOString(),
      request,
      inventorySnapshot,
      recommendations,
    };
  }

  private serializeFavorite(record: PrismaRecipeFavorite): RecipeFavorite {
    return {
      id: record.id,
      ownerKey: record.ownerKey,
      sourceRecommendationId: record.sourceRecommendationId,
      sourceDishIndex: record.sourceDishIndex,
      dish: recipeRecommendationsPayloadSchema.shape.recommendations.element.parse(
        record.dishSnapshot,
      ),
      inventorySnapshot: recipeInventorySnapshotItemSchema
        .array()
        .parse(record.inventorySnapshot),
      createdAt: record.createdAt.toISOString(),
    };
  }

  private getModel() {
    return process.env.RECIPE_AI_MODEL ?? DEFAULT_MODEL;
  }
}

function recipeScope(ownerKey: string, spaceId?: string) {
  return spaceId ? { spaceId } : { ownerKey };
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
    "",
    "[조리 단계 작성 규칙]",
    "steps는 초보도 바로 따라 할 수 있도록 구체적이고 디테일하게 작성하세요.",
    "각 추천의 steps는 4~8단계로 구성하고, 한 단계에는 핵심 행동 하나만 담으세요.",
    "각 단계 문장에는 가능하면 다음을 포함하세요: 실제 사용량(ml/g/개/큰술), 불 세기(약불/중불/강불), 대략 시간(분/초), 완성 감각 기준(거품이 난다, 가장자리가 노릇해진다 등).",
    "재료 목록의 포장 단위(예: 우유 1L)를 그대로 쓰지 말고, 이 요리에 실제로 쓰는 분량을 단계와 tips에 명시하세요.",
    "usedIngredients의 각 항목에는 이 요리에 실제로 사용할 정수 amount와 unitCode를 반드시 넣으세요.",
    "unitCode는 ea, ml, g 중 하나만 쓰고, ml와 g는 최소 단위 정수로 적으세요. 예: 우유 0.5L는 amount 500, unitCode ml입니다.",
    "inventoryItemId가 있는 재료는 입력 inventory의 unitCode와 같은 단위를 쓰고 amount가 quantityBase를 넘지 않게 하세요.",
    "면·밥·고기·계란처럼 익힘 시간이 중요한 재료는 분 단위로 안내하세요. 패키지 표기가 있으면 '표기 시간의 약 1분 전'처럼 표현해도 됩니다.",
    "'적당히', '잘', '살짝', '충분히'만으로 끝내거나 '끓인다', '섞는다', '익힌다'처럼 한 단어에 가까운 뭉뚱그린 단계는 금지합니다.",
    "나쁜 예: '면을 삶는다.' / 좋은 예: '소금 1작은술을 넣은 끓는 물에 면을 넣고 7~8분 삶아 알덴테로 익힌 뒤, 면수는 종이컵 반 컵(약 100ml)만 남기고 건집니다.'",
    "나쁜 예: '우유와 치즈를 넣고 녹인다.' / 좋은 예: '팬에 우유 200ml를 넣고 약불로 2~3분 데운 뒤, 치즈를 넣고 국자로 30초~1분 저어 완전히 녹입니다.'",
    "tips에는 농도 조절, 간 맞추기, 재료가 적을 때의 대체법처럼 실패를 줄이는 실전 조언을 1~3개 넣으세요.",
    "cookingTimeMinutes는 모든 단계 시간의 합과 크게 어긋나지 않게 맞추고, maxCookingMinutes를 넘기지 마세요.",
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
        usedIngredientUnits: ["ea", "ml", "g"],
        requireUsedIngredientAmount: true,
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
