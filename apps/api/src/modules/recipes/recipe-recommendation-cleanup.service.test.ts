import { describe, expect, it, vi } from "vitest";
import { RecipeRecommendationCleanupService } from "./recipe-recommendation-cleanup.service";

describe("RecipeRecommendationCleanupService", () => {
  it("deletes recommendations past the 90-day cutoff when no favorite protects them", async () => {
    const executeRaw = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    const schedulerLease = {
      findUnique: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = { $executeRaw: executeRaw, schedulerLease };
    const service = new RecipeRecommendationCleanupService(prisma as never);
    const leaseOwnerId = Reflect.get(service, "leaseOwnerId") as string;
    schedulerLease.findUnique.mockResolvedValue({ ownerId: leaseOwnerId });
    const now = new Date("2026-08-30T12:00:00.000Z");

    await expect(service.runCleanup(now)).resolves.toEqual({
      skippedByLock: false,
      deletedCount: 3,
    });

    expect(executeRaw).toHaveBeenCalledTimes(2);
    const cleanupCall = executeRaw.mock.calls[1];
    expect(cleanupCall?.[1]).toEqual(new Date("2026-06-01T12:00:00.000Z"));
    expect(String(cleanupCall?.[0])).toContain("NOT EXISTS");
    expect(String(cleanupCall?.[0])).toContain("RecipeFavorite");
    expect(schedulerLease.deleteMany).toHaveBeenCalledWith({
      where: {
        key: "recipe_recommendation_cleanup",
        ownerId: leaseOwnerId,
      },
    });
  });

  it("does not clean up when another replica owns the lease", async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const schedulerLease = {
      findUnique: vi.fn().mockResolvedValue({ ownerId: "another-replica" }),
      deleteMany: vi.fn(),
    };
    const prisma = { $executeRaw: executeRaw, schedulerLease };
    const service = new RecipeRecommendationCleanupService(prisma as never);

    await expect(service.runCleanup()).resolves.toEqual({
      skippedByLock: true,
      deletedCount: 0,
    });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(schedulerLease.deleteMany).not.toHaveBeenCalled();
  });
});
