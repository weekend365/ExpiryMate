import type {
  RecipeInventorySnapshotItem,
  RecipePreference,
  RecipeRecommendationDish,
  RecipeRecommendationRequest,
} from "@expirymate/shared";
import { ProductCategory, UnitCode } from "@expirymate/shared";
import { BadGatewayException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.hoisted(() => vi.fn());
const eventCreateMock = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class OpenAiMock {
    responses = { parse: parseMock };
  },
}));
vi.mock("openai/helpers/zod", () => ({ zodTextFormat: vi.fn(() => ({})) }));

import { RecipePolicyService } from "./recipe-policy.service";
import { RecipesService } from "./recipes.service";

const request: RecipeRecommendationRequest = {
  servings: 2,
  maxCookingMinutes: 30,
  mealType: "any",
  useExpiringFirst: true,
};
const inventory: RecipeInventorySnapshotItem[] = [
  {
    inventoryItemId: "egg-1",
    name: "달걀",
    category: ProductCategory.EGG,
    quantity: 3,
    quantityBase: 3,
    unitCode: UnitCode.EA,
    storageLocation: "fridge",
    expiryDate: "2026-08-11",
    daysUntilExpiry: 1,
  },
];
const preference: RecipePreference = {
  allergens: [],
  excludedIngredients: [],
  dietaryStyle: "any",
  maxSpiceLevel: "any",
  availableEquipment: ["stovetop"],
  updatedAt: "2026-08-10T00:00:00.000Z",
};

function recommendations(servings = 2): RecipeRecommendationDish[] {
  return [1, 2, 3].map((index) => ({
    title: `달걀 요리 ${index}`,
    summary: "간단한 요리",
    cookingTimeMinutes: 15,
    difficulty: "easy",
    servings,
    usedIngredients: [
      { inventoryItemId: "egg-1", name: "계란", amount: 2, unitCode: UnitCode.EA },
    ],
    optionalMissingIngredients: [],
    steps: [
      "달걀의 상태를 먼저 확인해요.",
      "달걀을 그릇에 넣고 30초 저어요.",
      "팬에서 중불로 3분 익혀요.",
      "가장자리가 익으면 그릇에 담아요.",
    ],
    tips: ["약불을 유지해요"],
    safetyNote: "상태를 확인해요",
    spiceLevel: "none",
    requiredEquipment: ["stovetop"],
    mealType: "dinner",
    strategy: ["expiring_first", "minimal_extra", "quick_novel"][index - 1] as
      | "expiring_first"
      | "minimal_extra"
      | "quick_novel",
  }));
}

function response(dishes: RecipeRecommendationDish[], input = 10, output = 20) {
  return {
    output: [],
    output_parsed: { recommendations: dishes },
    usage: {
      input_tokens: input,
      input_tokens_details: { cached_tokens: 2 },
      output_tokens: output,
      total_tokens: input + output,
    },
  };
}

describe("RecipesService semantic repair", () => {
  afterEach(() => {
    parseMock.mockReset();
    eventCreateMock.mockReset();
    delete process.env.OPENAI_API_KEY;
  });

  it("sends the Terra candidate with explicit none reasoning", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock.mockResolvedValueOnce(response(recommendations(2), 10, 20));

    await generate(createService(), {
      model: "gpt-5.6-terra",
      variant: "candidate",
    });

    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-terra",
        reasoning: { effort: "none" },
        metadata: expect.objectContaining({ variant: "candidate" }),
      }),
    );
  });

  it("repairs once and aggregates both attempts", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock
      .mockResolvedValueOnce(response(recommendations(1), 10, 20))
      .mockResolvedValueOnce(response(recommendations(2), 15, 25));
    const service = createService();

    const result = await generate(service);

    expect(result.generationAttempts).toBe(2);
    expect(result.repairApplied).toBe(true);
    expect(result.usage).toEqual({
      inputTokens: 25,
      cachedInputTokens: 4,
      outputTokens: 45,
      totalTokens: 70,
    });
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("repairs unit and quantity mismatches instead of silently clamping them", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const dishes = recommendations(2).map((dish) => ({
      ...dish,
      usedIngredients: [
        {
          inventoryItemId: "egg-1",
          name: "계란",
          amount: 9,
          unitCode: UnitCode.G,
        },
      ],
    }));
    parseMock
      .mockResolvedValueOnce(response(dishes, 10, 20))
      .mockResolvedValueOnce(response(recommendations(2), 12, 22));

    const result = await generate(createService());

    expect(result.generationAttempts).toBe(2);
    expect(result.repairApplied).toBe(true);
    expect(result.recommendations[0]?.usedIngredients[0]).toMatchObject({
      name: "달걀",
      amount: 2,
      unitCode: UnitCode.EA,
    });
    expect(parseMock).toHaveBeenCalledTimes(2);
    expect(parseMock.mock.calls[1]?.[0]?.input).toContain(
      "DISH_1_INGREDIENT_1_QUANTITY_EXCEEDED",
    );
  });

  it("returns a gateway failure after an invalid repair", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock.mockResolvedValue(response(recommendations(1)));
    await expect(generate(createService())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(parseMock).toHaveBeenCalledTimes(2);
    expect(eventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          failureCode: "semantic_validation",
          inputTokens: 20,
          cachedInputTokens: 4,
          outputTokens: 40,
          generationAttempts: 2,
          repairApplied: true,
          durationMs: expect.any(Number),
        }),
      }),
    );
  });

  it("handles an explicit refusal", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock.mockResolvedValue({
      output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
      output_parsed: null,
      usage: {
        input_tokens: 30,
        input_tokens_details: { cached_tokens: 5 },
        output_tokens: 4,
        total_tokens: 34,
      },
    });
    await expect(generate(createService())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(eventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          failureCode: "refusal",
          inputTokens: 30,
          cachedInputTokens: 5,
          outputTokens: 4,
        }),
      }),
    );
  });

  it("handles an explicitly incomplete response", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock.mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [],
      output_parsed: null,
    });
    await expect(generate(createService())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(eventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          failureCode: "incomplete",
          durationMs: expect.any(Number),
        }),
      }),
    );
  });
});

function createService() {
  const prisma = {
    recipeRecommendation: { aggregate: vi.fn() },
    recipeAiGenerationEvent: { create: eventCreateMock.mockResolvedValue({}) },
  };
  return new RecipesService(
    prisma as never,
    {} as never,
    new RecipePolicyService(prisma as never),
    {} as never,
    {} as never,
  );
}

function generate(
  service: RecipesService,
  modelSelection: {
    model: string;
    variant: "control" | "candidate";
  } = { model: "gpt-5.4-mini", variant: "control" },
) {
  return (
    service as unknown as {
      generateRecommendations: (
        ownerKey: string,
        generationRequest: RecipeRecommendationRequest,
        snapshot: RecipeInventorySnapshotItem[],
        generationPreference: RecipePreference,
        personalization: {
          positiveDishTitles: string[];
          dismissedDishTitles: string[];
          recentDishTitles: string[];
        },
        modelSelection: {
          model: string;
          variant: "control" | "candidate";
        },
        spaceId?: string,
      ) => Promise<{
        recommendations: RecipeRecommendationDish[];
        usage: {
          inputTokens: number;
          cachedInputTokens: number;
          outputTokens: number;
          totalTokens: number;
        };
        estimatedCostUsd: number;
        generationAttempts: number;
        repairApplied: boolean;
        durationMs: number;
      }>;
    }
  ).generateRecommendations(
    "owner-a",
    request,
    inventory,
    preference,
    {
      positiveDishTitles: [],
      dismissedDishTitles: [],
      recentDishTitles: [],
    },
    modelSelection,
  );
}
