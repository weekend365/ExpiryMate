import { randomUUID } from "node:crypto";
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS } from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";

const CLEANUP_LEASE_KEY = "recipe_recommendation_cleanup";
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const LEASE_TTL_MS = CLEANUP_INTERVAL_MS + 5 * 60 * 1000;
const RETENTION_MS =
  UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class RecipeRecommendationCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RecipeRecommendationCleanupService.name);
  private readonly leaseOwnerId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    void this.runCleanup().catch((error: unknown) => {
      this.logger.error("Initial recipe recommendation cleanup failed", error);
    });
    this.timer = setInterval(() => {
      void this.runCleanup().catch((error: unknown) => {
        this.logger.error("Scheduled recipe recommendation cleanup failed", error);
      });
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    void this.releaseLease().catch((error: unknown) => {
      this.logger.warn("Failed to release recipe cleanup lease", error);
    });
  }

  async runCleanup(now = new Date()) {
    const leased = await this.tryAcquireLease(now);
    if (!leased) {
      return { skippedByLock: true as const, deletedCount: 0 };
    }

    try {
      const cutoff = new Date(now.getTime() - RETENTION_MS);
      const deletedCount = await this.prisma.$executeRaw`
        DELETE FROM "RecipeRecommendation" AS recommendation
        WHERE recommendation."createdAt" <= ${cutoff}
          AND NOT EXISTS (
            SELECT 1
            FROM "RecipeFavorite" AS favorite
            WHERE favorite."sourceRecommendationId" = recommendation."id"
          )
      `;
      if (deletedCount > 0) {
        this.logger.log(
          `Deleted ${deletedCount} unfavorited recipe recommendations older than ${UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS} days`,
        );
      }
      return { skippedByLock: false as const, deletedCount };
    } finally {
      await this.releaseLease();
    }
  }

  private async tryAcquireLease(now: Date) {
    const expiresAt = new Date(now.getTime() + LEASE_TTL_MS);
    await this.prisma.$executeRaw`
      INSERT INTO "SchedulerLease" ("key", "ownerId", "expiresAt", "updatedAt")
      VALUES (${CLEANUP_LEASE_KEY}, ${this.leaseOwnerId}, ${expiresAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "ownerId" = EXCLUDED."ownerId",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE "SchedulerLease"."expiresAt" < ${now}
         OR "SchedulerLease"."ownerId" = ${this.leaseOwnerId}
    `;
    const lease = await this.prisma.schedulerLease.findUnique({
      where: { key: CLEANUP_LEASE_KEY },
      select: { ownerId: true },
    });
    return lease?.ownerId === this.leaseOwnerId;
  }

  private async releaseLease() {
    await this.prisma.schedulerLease.deleteMany({
      where: { key: CLEANUP_LEASE_KEY, ownerId: this.leaseOwnerId },
    });
  }
}
