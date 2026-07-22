import { getKstDayStart } from "@expirymate/shared";
import { describe, expect, it, vi } from "vitest";
import { RecipePolicyService } from "./recipe-policy.service";

describe("RecipePolicyService KST day window", () => {
  it("counts daily quota from KST midnight, not server-local midnight", async () => {
    const prisma = {
      recipeRecommendation: {
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const policy = new RecipePolicyService(prisma as never);
    process.env.RECIPE_DAILY_QUOTA = "5";

    // 2026-06-10 00:30 KST == 2026-06-09T15:30:00.000Z
    const now = new Date("2026-06-09T15:30:00.000Z");
    await policy.enforceDailyQuota("owner-a", now);

    expect(prisma.recipeRecommendation.count).toHaveBeenCalledWith({
      where: {
        ownerKey: "owner-a",
        aiProvider: "openai",
        createdAt: {
          gte: getKstDayStart(now),
        },
      },
    });
    expect(getKstDayStart(now).toISOString()).toBe("2026-06-09T15:00:00.000Z");
  });
});
