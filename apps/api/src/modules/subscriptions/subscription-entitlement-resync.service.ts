import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { SubscriptionsService } from "./subscriptions.service";

const RESYNC_LEASE_KEY = "subscription_entitlement_resync";
const DEFAULT_INTERVAL_MINUTES = 360;

@Injectable()
export class SubscriptionEntitlementResyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SubscriptionEntitlementResyncService.name);
  private readonly leaseOwnerId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  onApplicationBootstrap() {
    if (!isResyncSchedulerEnabled()) {
      return;
    }

    void this.runResync().catch((error: unknown) => {
      this.logger.error("Initial subscription entitlement resync failed", error);
    });

    this.timer = setInterval(() => {
      void this.runResync().catch((error: unknown) => {
        this.logger.error("Scheduled subscription entitlement resync failed", error);
      });
    }, getResyncIntervalMs());
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    void this.releaseLease(RESYNC_LEASE_KEY, this.leaseOwnerId).catch(
      (error: unknown) => {
        this.logger.warn(
          "Failed to release subscription entitlement resync lease on shutdown",
          error,
        );
      },
    );
  }

  async runResync(now = new Date()) {
    if (!isResyncSchedulerEnabled()) {
      return {
        skippedByFlag: true as const,
        skippedByLock: false as const,
      };
    }

    const leased = await this.tryAcquireLease(
      RESYNC_LEASE_KEY,
      this.leaseOwnerId,
      getLeaseTtlMs(),
      now,
    );
    if (!leased) {
      return {
        skippedByFlag: false as const,
        skippedByLock: true as const,
      };
    }

    try {
      const apple = await this.subscriptionsService.resyncAppleEntitlements({
        limit: getBatchSize(),
        now,
      });
      const google = await this.subscriptionsService.applyGoogleVoidedPurchases({
        now,
      });

      if (
        apple.updated > 0 ||
        apple.failed > 0 ||
        google.entitlementsRevoked > 0 ||
        google.creditsRevoked > 0
      ) {
        this.logger.log(
          `Subscription resync: apple scanned=${apple.scanned} updated=${apple.updated} failed=${apple.failed}; google voids sub=${google.subscriptionVoids} product=${google.productVoids} entitlementsRevoked=${google.entitlementsRevoked} creditsRevoked=${google.creditsRevoked}`,
        );
      }

      return {
        skippedByFlag: false as const,
        skippedByLock: false as const,
        apple,
        google,
      };
    } finally {
      await this.releaseLease(RESYNC_LEASE_KEY, this.leaseOwnerId);
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

function isResyncSchedulerEnabled() {
  return (
    process.env.SUBSCRIPTION_RESYNC_SCHEDULER_ENABLED?.trim().toLowerCase() ===
    "true"
  );
}

function getResyncIntervalMs() {
  return (
    readPositiveIntegerEnv(
      "SUBSCRIPTION_RESYNC_INTERVAL_MINUTES",
      DEFAULT_INTERVAL_MINUTES,
    ) *
    60 *
    1000
  );
}

function getLeaseTtlMs() {
  return getResyncIntervalMs() + 5 * 60 * 1000;
}

function getBatchSize() {
  return readPositiveIntegerEnv("SUBSCRIPTION_RESYNC_BATCH_SIZE", 50);
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
