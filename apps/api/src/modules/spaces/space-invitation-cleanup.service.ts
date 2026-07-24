import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import {
  SPACE_INVITATION_RETENTION_AFTER_INACTIVE_DAYS,
} from "@expirymate/shared";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { SpacesService } from "./spaces.service";

const CLEANUP_LEASE_KEY = "space_invitation_cleanup";
const DEFAULT_INTERVAL_HOURS = 24;

@Injectable()
export class SpaceInvitationCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SpaceInvitationCleanupService.name);
  private readonly leaseOwnerId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly spacesService: SpacesService,
  ) {}

  onApplicationBootstrap() {
    void this.runCleanup().catch((error: unknown) => {
      this.logger.error("Initial space invitation cleanup failed", error);
    });

    this.timer = setInterval(() => {
      void this.runCleanup().catch((error: unknown) => {
        this.logger.error("Scheduled space invitation cleanup failed", error);
      });
    }, getCleanupIntervalMs());
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    void this.releaseLease(CLEANUP_LEASE_KEY, this.leaseOwnerId).catch(
      (error: unknown) => {
        this.logger.warn(
          "Failed to release space invitation cleanup lease on shutdown",
          error,
        );
      },
    );
  }

  async runCleanup(now = new Date()) {
    const leased = await this.tryAcquireLease(
      CLEANUP_LEASE_KEY,
      this.leaseOwnerId,
      getLeaseTtlMs(),
      now,
    );
    if (!leased) {
      return { skippedByLock: true as const, deletedCount: 0, redactedCount: 0 };
    }

    try {
      const result = await this.spacesService.purgeInactiveInvitations(now);
      if (result.deletedCount > 0 || result.redactedCount > 0) {
        this.logger.log(
          `Space invitation cleanup: redacted ${result.redactedCount}, deleted ${result.deletedCount} (retention ${SPACE_INVITATION_RETENTION_AFTER_INACTIVE_DAYS}d)`,
        );
      }
      return { skippedByLock: false as const, ...result };
    } finally {
      await this.releaseLease(CLEANUP_LEASE_KEY, this.leaseOwnerId);
    }
  }

  private async tryAcquireLease(
    key: string,
    ownerId: string,
    ttlMs: number,
    now: Date,
  ) {
    const expiresAt = new Date(now.getTime() + ttlMs);

    await this.prisma.$executeRaw`
      INSERT INTO "SchedulerLease" ("key", "ownerId", "expiresAt", "updatedAt")
      VALUES (${key}, ${ownerId}, ${expiresAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "ownerId" = EXCLUDED."ownerId",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE "SchedulerLease"."expiresAt" < ${now}
         OR "SchedulerLease"."ownerId" = ${ownerId}
    `;

    const lease = await this.prisma.schedulerLease.findUnique({
      where: { key },
      select: { ownerId: true },
    });

    return lease?.ownerId === ownerId;
  }

  private async releaseLease(key: string, ownerId: string) {
    await this.prisma.schedulerLease.deleteMany({
      where: {
        key,
        ownerId,
      },
    });
  }
}

function getCleanupIntervalMs() {
  const hours = readPositiveIntegerEnv(
    "SPACE_INVITATION_CLEANUP_INTERVAL_HOURS",
    DEFAULT_INTERVAL_HOURS,
  );
  return hours * 60 * 60 * 1000;
}

function getLeaseTtlMs() {
  return getCleanupIntervalMs() + 5 * 60 * 1000;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
