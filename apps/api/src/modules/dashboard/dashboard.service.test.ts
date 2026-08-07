import { describe, expect, it, vi } from "vitest";
import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  it("includes the first dish from the latest recommendation", async () => {
    const latestRecommendation = {
      id: "recommendation-1",
      createdAt: new Date("2026-07-29T03:00:00.000Z"),
      inventorySnapshot: [
        {
          inventoryItemId: "tofu-1",
          name: "두부",
          quantity: 1,
          storageLocation: "fridge",
          expiryDate: "2026-07-31",
          daysUntilExpiry: 8,
        },
        {
          inventoryItemId: "egg-1",
          name: "달걀",
          quantity: 6,
          storageLocation: "fridge",
          expiryDate: "2026-08-02",
          daysUntilExpiry: 10,
        },
        {
          inventoryItemId: "milk-1",
          name: "우유",
          quantity: 1,
          storageLocation: "fridge",
          expiryDate: "2026-07-28",
          daysUntilExpiry: 5,
        },
      ],
      recommendations: [
        {
          title: "두부 달걀 볶음",
          summary: "두부와 달걀로 만드는 간단한 볶음 요리",
          cookingTimeMinutes: 15,
          difficulty: "easy",
          servings: 2,
          usedIngredients: [
            { inventoryItemId: "milk-1", name: "우유" },
            { inventoryItemId: "egg-1", name: "달걀" },
            { inventoryItemId: "tofu-1", name: "두부" },
          ],
          optionalMissingIngredients: [],
          steps: ["재료를 볶아요."],
          tips: [],
          safetyNote: "",
        },
      ],
    };
    const prisma = createPrismaMock(latestRecommendation);
    const service = new DashboardService(prisma as never);

    const summary = await service.getSummary(
      "user-1",
      new Date("2026-07-29T03:00:00.000Z"),
      "space-1",
    );

    expect(prisma.recipeRecommendation.findFirst).toHaveBeenCalledWith({
      where: { spaceId: "space-1" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        inventorySnapshot: true,
        recommendations: true,
      },
    });
    expect(summary.latestRecommendationPreview).toEqual({
      recommendationId: "recommendation-1",
      createdAt: "2026-07-29T03:00:00.000Z",
      title: "두부 달걀 볶음",
      cookingTimeMinutes: 15,
      difficulty: "easy",
      servings: 2,
      reasonIngredients: [
        { name: "두부", daysUntilExpiry: 2 },
        { name: "달걀", daysUntilExpiry: 4 },
      ],
    });
  });

  it("returns a null preview when stored recommendation JSON is invalid", async () => {
    const prisma = createPrismaMock({
      id: "recommendation-invalid",
      createdAt: new Date("2026-07-29T03:00:00.000Z"),
      inventorySnapshot: [],
      recommendations: [{ title: "" }],
    });
    const service = new DashboardService(prisma as never);

    const summary = await service.getSummary(
      "user-1",
      new Date("2026-07-29T03:00:00.000Z"),
    );

    expect(prisma.recipeRecommendation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerKey: "user-1" } }),
    );
    expect(summary.latestRecommendationPreview).toBeNull();
  });
});

function createPrismaMock(latestRecommendation: unknown) {
  return {
    inventoryItem: {
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    recipeRecommendation: {
      findFirst: vi.fn().mockResolvedValue(latestRecommendation),
    },
  };
}
