import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "@prisma/client";

const DEFAULT_CLEANUP_INTERVAL_MINUTES = 60;

@Injectable()
export class InventoryPhotoParseCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(InventoryPhotoParseCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    void this.runCleanup().catch((error: unknown) => {
      this.logger.error("Initial photo parse result cleanup failed", error);
    });
    this.timer = setInterval(() => {
      void this.runCleanup().catch((error: unknown) => {
        this.logger.error("Scheduled photo parse result cleanup failed", error);
      });
    }, getCleanupIntervalMs());
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCleanup(now = new Date()) {
    const result = await this.prisma.inventoryPhotoParseEvent.updateMany({
      where: {
        resultPayload: { not: Prisma.DbNull },
        resultExpiresAt: { lte: now },
      },
      data: {
        resultPayload: Prisma.DbNull,
        resultExpiresAt: null,
      },
    });
    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} expired photo parse results`);
    }
    return result.count;
  }
}

function getCleanupIntervalMs() {
  const raw = Number.parseInt(
    process.env.INVENTORY_PHOTO_PARSE_RESULT_CLEANUP_INTERVAL_MINUTES ?? "",
    10,
  );
  const minutes = Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_CLEANUP_INTERVAL_MINUTES;
  return minutes * 60 * 1000;
}
