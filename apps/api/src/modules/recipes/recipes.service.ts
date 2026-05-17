import {
  BadGatewayException,
  BadRequestException,
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
  recipeInventorySnapshotItemSchema,
  recipeRecommendationRequestSchema,
  recipeRecommendationsPayloadSchema,
} from "@expirymate/shared";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { PrismaService } from "../../database/prisma.service";
import { CreateRecipeRecommendationDto } from "./dto/create-recipe-recommendation.dto";

const PROMPT_VERSION = "recipe-recommendation-v1";
const DEFAULT_OWNER_KEY = "demo-user";
const DEFAULT_MODEL = "gpt-5-mini";
const MAX_INGREDIENTS = 30;

const nonFoodCategories = new Set<ProductCategory>([
  ProductCategory.personal_care,
  ProductCategory.paper_goods,
  ProductCategory.cleaning,
  ProductCategory.household,
]);

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRecommendation(dto: CreateRecipeRecommendationDto) {
    const request = recipeRecommendationRequestSchema.parse({
      ownerKey: dto.ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? DEFAULT_OWNER_KEY,
      servings: dto.servings ?? 2,
      maxCookingMinutes: dto.maxCookingMinutes ?? 30,
      mealType: dto.mealType ?? "any",
      useExpiringFirst: dto.useExpiringFirst ?? true,
    });

    const inventorySnapshot = await this.buildInventorySnapshot(request);

    if (inventorySnapshot.length === 0) {
      throw new BadRequestException("추천 가능한 재료가 없습니다.");
    }

    const recommendations = await this.generateRecommendations(
      request,
      inventorySnapshot,
    );

    const record = await this.prisma.recipeRecommendation.create({
      data: {
        ownerKey: request.ownerKey ?? DEFAULT_OWNER_KEY,
        request: toJson(request),
        inventorySnapshot: toJson(inventorySnapshot),
        recommendations: toJson(recommendations),
        aiProvider: "openai",
        aiModel: this.getModel(),
        promptVersion: PROMPT_VERSION,
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

  async getRecommendation(id: string) {
    const record = await this.prisma.recipeRecommendation.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException("추천 결과를 찾을 수 없습니다.");
    }

    return this.serializeRecommendation(record);
  }

  private async buildInventorySnapshot(
    request: RecipeRecommendationRequest,
  ): Promise<RecipeInventorySnapshotItem[]> {
    const today = startOfToday();
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        ownerKey: request.ownerKey ?? DEFAULT_OWNER_KEY,
        status: "active",
        expiryDate: {
          gte: today,
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
      expiryDate: item.expiryDate.toISOString(),
      daysUntilExpiry: differenceInCalendarDays(item.expiryDate, today),
    }));
  }

  private async generateRecommendations(
    request: RecipeRecommendationRequest,
    inventorySnapshot: RecipeInventorySnapshotItem[],
  ): Promise<RecipeRecommendationDish[]> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API 키가 설정되지 않았습니다.");
    }

    const client = new OpenAI({ apiKey });

    try {
      const response = await client.responses.parse({
        model: this.getModel(),
        instructions: buildInstructions(),
        input: buildInput(request, inventorySnapshot),
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

      return recipeRecommendationsPayloadSchema.parse(parsed).recommendations;
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

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function differenceInCalendarDays(date: Date, baseDate: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - baseDate.getTime()) / dayMs);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
