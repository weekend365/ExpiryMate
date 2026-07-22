import { randomUUID } from "node:crypto";
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import {
  ItemStatus,
  Prisma,
  PushNotificationDeliveryStatus,
  PushTokenPlatform,
} from "@prisma/client";
import { dateOnlyToUtcDate } from "@expirymate/shared";
import { serializePushToken } from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import {
  ExpoPushService,
  type ExpoPushReceipt,
  type ExpoPushTicket,
} from "./expo-push.service";

const DEFAULT_INTERVAL_MINUTES = 30;
const DEFAULT_DELIVERY_HOUR = 9;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEZONE_OFFSET_MINUTES = 9 * 60;
const DEFAULT_STALE_PENDING_MINUTES = 15;
const DEFAULT_RECEIPT_MIN_AGE_MINUTES = 5;
const DEFAULT_RECEIPT_BATCH_SIZE = 100;
const PUSH_REMINDER_LEASE_KEY = "push_reminders";

interface ReminderStats {
  preferencesChecked: number;
  itemsMatched: number;
  notificationsCreated: number;
  notificationsSent: number;
  notificationsFailed: number;
  tokensDisabled: number;
  stalePendingRetried: number;
  receiptsChecked: number;
  receiptsFailed: number;
  skippedByTime: boolean;
  skippedByLock: boolean;
}

interface DueItem {
  id: string;
  displayName: string;
}

@Injectable()
export class NotificationsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsService.name);
  private readonly leaseOwnerId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {}

  onApplicationBootstrap() {
    if (!isSchedulerEnabled()) {
      return;
    }

    void this.runDueReminders().catch((error: unknown) => {
      this.logger.error("Initial push reminder batch failed", error);
    });

    this.timer = setInterval(() => {
      void this.runDueReminders().catch((error: unknown) => {
        this.logger.error("Scheduled push reminder batch failed", error);
      });
    }, getSchedulerIntervalMs());
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    void this.releaseLease(PUSH_REMINDER_LEASE_KEY, this.leaseOwnerId).catch(
      (error: unknown) => {
        this.logger.warn("Failed to release push reminder lease on shutdown", error);
      },
    );
  }

  async registerPushToken(ownerKey: string, dto: RegisterPushTokenDto) {
    const now = new Date();
    const pushToken = await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: {
        ownerKey,
        platform: toPushTokenPlatform(dto.platform),
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        enabled: true,
        disabledAt: null,
        lastSeenAt: now,
      },
      create: {
        ownerKey,
        token: dto.token,
        platform: toPushTokenPlatform(dto.platform),
        deviceId: dto.deviceId,
        appVersion: dto.appVersion,
        enabled: true,
        lastSeenAt: now,
      },
    });

    return serializePushToken(pushToken);
  }

  async unregisterPushToken(ownerKey: string, token: string) {
    await this.prisma.pushToken.updateMany({
      where: {
        ownerKey,
        token,
      },
      data: {
        enabled: false,
        disabledAt: new Date(),
      },
    });

    return { ok: true as const };
  }

  async runDueReminders(now = new Date()): Promise<ReminderStats> {
    const stats: ReminderStats = {
      preferencesChecked: 0,
      itemsMatched: 0,
      notificationsCreated: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      tokensDisabled: 0,
      stalePendingRetried: 0,
      receiptsChecked: 0,
      receiptsFailed: 0,
      skippedByTime: false,
      skippedByLock: false,
    };

    const leased = await this.tryAcquireLease(
      PUSH_REMINDER_LEASE_KEY,
      this.leaseOwnerId,
      getLeaseTtlMs(),
      now,
    );

    if (!leased) {
      stats.skippedByLock = true;
      return stats;
    }

    try {
      await this.processPushReceipts(now, stats);
      await this.recoverStalePendingDeliveries(now, stats);

      if (getLocalHour(now) < getDeliveryHour()) {
        stats.skippedByTime = true;
        return stats;
      }

      await this.sendDueExpiryReminders(now, stats);
      return stats;
    } finally {
      await this.releaseLease(PUSH_REMINDER_LEASE_KEY, this.leaseOwnerId);
    }
  }

  private async sendDueExpiryReminders(now: Date, stats: ReminderStats) {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        enabled: true,
        owner: {
          deletedAt: null,
          mergedIntoUserId: null,
          pushTokens: {
            some: {
              enabled: true,
            },
          },
        },
      },
      include: {
        owner: {
          select: {
            pushTokens: {
              where: {
                enabled: true,
              },
              select: {
                id: true,
                token: true,
              },
            },
          },
        },
      },
    });

    for (const preference of preferences) {
      stats.preferencesChecked += 1;

      if (isWithinQuietHours(now, preference.quietHoursStart, preference.quietHoursEnd)) {
        continue;
      }

      const daysBeforeValues = getReminderDays(
        preference.reminderDaysBefore,
        preference.remindOnDayOf,
      );

      for (const daysBefore of daysBeforeValues) {
        const reminderDate = dateOnlyToUtcDate(
          getLocalDateOnly(now, daysBefore),
        );
        const items = await this.prisma.inventoryItem.findMany({
          where: {
            ownerKey: preference.ownerKey,
            status: ItemStatus.active,
            expiryDate: reminderDate,
          },
          select: {
            id: true,
            displayName: true,
          },
          orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
        });

        stats.itemsMatched += items.length;

        for (const item of items) {
          for (const pushToken of preference.owner.pushTokens) {
            const delivery = await this.createPendingDelivery({
              ownerKey: preference.ownerKey,
              pushTokenId: pushToken.id,
              inventoryItemId: item.id,
              reminderDate,
              daysBefore,
              ...buildReminderCopy(item, daysBefore),
            });

            if (!delivery) {
              continue;
            }

            stats.notificationsCreated += 1;
            await this.dispatchDelivery(
              delivery,
              {
                id: pushToken.id,
                token: pushToken.token,
              },
              item.id,
              daysBefore,
              stats,
            );
          }
        }
      }
    }
  }

  private async recoverStalePendingDeliveries(now: Date, stats: ReminderStats) {
    const staleBefore = new Date(now.getTime() - getStalePendingMs());
    const staleDeliveries = await this.prisma.pushNotificationDelivery.findMany({
      where: {
        status: PushNotificationDeliveryStatus.pending,
        updatedAt: {
          lt: staleBefore,
        },
        attempts: {
          lt: getMaxAttempts(),
        },
        pushToken: {
          enabled: true,
        },
      },
      include: {
        pushToken: {
          select: {
            id: true,
            token: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: getReceiptBatchSize(),
    });

    for (const delivery of staleDeliveries) {
      const claimed = await this.prisma.pushNotificationDelivery.updateMany({
        where: {
          id: delivery.id,
          status: PushNotificationDeliveryStatus.pending,
          updatedAt: delivery.updatedAt,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      stats.stalePendingRetried += 1;
      stats.notificationsCreated += 1;
      await this.dispatchDelivery(
        {
          id: delivery.id,
          title: delivery.title,
          body: delivery.body,
        },
        {
          id: delivery.pushToken.id,
          token: delivery.pushToken.token,
        },
        delivery.inventoryItemId,
        delivery.daysBefore,
        stats,
      );
    }
  }

  private async processPushReceipts(now: Date, stats: ReminderStats) {
    const readyBefore = new Date(now.getTime() - getReceiptMinAgeMs());
    const deliveries = await this.prisma.pushNotificationDelivery.findMany({
      where: {
        status: PushNotificationDeliveryStatus.sent,
        receiptCheckedAt: null,
        expoTicketId: {
          not: null,
        },
        sentAt: {
          lte: readyBefore,
        },
      },
      select: {
        id: true,
        expoTicketId: true,
        pushTokenId: true,
      },
      orderBy: {
        sentAt: "asc",
      },
      take: getReceiptBatchSize(),
    });

    if (deliveries.length === 0) {
      return;
    }

    const ticketIds = deliveries
      .map((delivery) => delivery.expoTicketId)
      .filter((ticketId): ticketId is string => Boolean(ticketId));
    const receipts = await this.expoPush.getReceipts(ticketIds);
    const checkedAt = new Date();

    for (const delivery of deliveries) {
      const ticketId = delivery.expoTicketId;
      if (!ticketId) {
        continue;
      }

      const receipt = receipts[ticketId];
      if (!receipt) {
        // Receipt not ready yet — leave receiptCheckedAt null for the next pass.
        continue;
      }

      stats.receiptsChecked += 1;
      await this.applyPushReceipt(delivery.id, delivery.pushTokenId, receipt, checkedAt, stats);
    }
  }

  private async applyPushReceipt(
    deliveryId: string,
    pushTokenId: string,
    receipt: ExpoPushReceipt,
    checkedAt: Date,
    stats: ReminderStats,
  ) {
    if (receipt.status === "ok") {
      await this.prisma.pushNotificationDelivery.update({
        where: { id: deliveryId },
        data: {
          receiptCheckedAt: checkedAt,
          errorCode: null,
          errorMessage: null,
        },
      });
      return;
    }

    stats.receiptsFailed += 1;
    await this.prisma.pushNotificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: PushNotificationDeliveryStatus.failed,
        receiptCheckedAt: checkedAt,
        errorCode: receipt.details?.error ?? "EXPO_PUSH_RECEIPT_ERROR",
        errorMessage:
          receipt.message ?? "Expo Push receipt reported delivery failure.",
      },
    });

    if (receipt.details?.error === "DeviceNotRegistered") {
      await this.disablePushToken(pushTokenId, stats);
    }
  }

  private async dispatchDelivery(
    delivery: { id: string; title: string; body: string },
    pushToken: { id: string; token: string },
    inventoryItemId: string,
    daysBefore: number,
    stats: ReminderStats,
  ) {
    const ticket = await this.expoPush.send({
      to: pushToken.token,
      title: delivery.title,
      body: delivery.body,
      data: {
        type: "expiry_reminder",
        inventoryItemId,
        daysBefore,
      },
    });
    const update = toDeliveryUpdate(ticket);

    await this.prisma.pushNotificationDelivery.update({
      where: { id: delivery.id },
      data: update,
    });

    if (ticket.status === "ok") {
      stats.notificationsSent += 1;
      return;
    }

    stats.notificationsFailed += 1;

    if (ticket.details?.error === "DeviceNotRegistered") {
      await this.disablePushToken(pushToken.id, stats);
    }
  }

  private async disablePushToken(pushTokenId: string, stats: ReminderStats) {
    await this.prisma.pushToken.update({
      where: { id: pushTokenId },
      data: {
        enabled: false,
        disabledAt: new Date(),
      },
    });
    stats.tokensDisabled += 1;
  }

  private async createPendingDelivery(params: {
    ownerKey: string;
    pushTokenId: string;
    inventoryItemId: string;
    reminderDate: Date;
    daysBefore: number;
    title: string;
    body: string;
  }) {
    try {
      return await this.prisma.pushNotificationDelivery.create({
        data: {
          ...params,
          status: PushNotificationDeliveryStatus.pending,
          attempts: 1,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.pushNotificationDelivery.findUnique({
          where: {
            pushTokenId_inventoryItemId_reminderDate_daysBefore: {
              pushTokenId: params.pushTokenId,
              inventoryItemId: params.inventoryItemId,
              reminderDate: params.reminderDate,
              daysBefore: params.daysBefore,
            },
          },
        });

        if (!existing || existing.attempts >= getMaxAttempts()) {
          return null;
        }

        const canRetryFailed =
          existing.status === PushNotificationDeliveryStatus.failed;
        const canRetryStalePending =
          existing.status === PushNotificationDeliveryStatus.pending &&
          isStalePending(existing.updatedAt, new Date());

        if (!canRetryFailed && !canRetryStalePending) {
          return null;
        }

        return this.prisma.pushNotificationDelivery.update({
          where: { id: existing.id },
          data: {
            title: params.title,
            body: params.body,
            status: PushNotificationDeliveryStatus.pending,
            attempts: {
              increment: 1,
            },
            errorCode: null,
            errorMessage: null,
            receiptCheckedAt: null,
            expoTicketId: null,
            sentAt: null,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Atomic lease via INSERT … ON CONFLICT DO UPDATE … WHERE expired/same owner.
   * Returns true only when this owner holds the row after the write.
   */
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

function toPushTokenPlatform(platform?: string) {
  if (
    platform === PushTokenPlatform.ios ||
    platform === PushTokenPlatform.android ||
    platform === PushTokenPlatform.web
  ) {
    return platform;
  }

  return PushTokenPlatform.unknown;
}

function isSchedulerEnabled() {
  return process.env.PUSH_REMINDER_SCHEDULER_ENABLED === "true";
}

function getSchedulerIntervalMs() {
  return (
    readPositiveIntegerEnv(
      "PUSH_REMINDER_SCHEDULER_INTERVAL_MINUTES",
      DEFAULT_INTERVAL_MINUTES,
    ) *
    60 *
    1000
  );
}

function getLeaseTtlMs() {
  // Slightly longer than one interval so a slow batch can finish before expiry.
  return getSchedulerIntervalMs() + 5 * 60 * 1000;
}

function getDeliveryHour() {
  return Math.min(
    23,
    readPositiveIntegerEnv("PUSH_REMINDER_DELIVERY_HOUR", DEFAULT_DELIVERY_HOUR),
  );
}

function getMaxAttempts() {
  return readPositiveIntegerEnv(
    "PUSH_REMINDER_MAX_ATTEMPTS",
    DEFAULT_MAX_ATTEMPTS,
  );
}

function getStalePendingMs() {
  return (
    readPositiveIntegerEnv(
      "PUSH_REMINDER_STALE_PENDING_MINUTES",
      DEFAULT_STALE_PENDING_MINUTES,
    ) *
    60 *
    1000
  );
}

function getReceiptMinAgeMs() {
  return (
    readPositiveIntegerEnv(
      "PUSH_REMINDER_RECEIPT_MIN_AGE_MINUTES",
      DEFAULT_RECEIPT_MIN_AGE_MINUTES,
    ) *
    60 *
    1000
  );
}

function getReceiptBatchSize() {
  return readPositiveIntegerEnv(
    "PUSH_REMINDER_RECEIPT_BATCH_SIZE",
    DEFAULT_RECEIPT_BATCH_SIZE,
  );
}

function getTimezoneOffsetMinutes() {
  return readIntegerEnv(
    "PUSH_REMINDER_TIMEZONE_OFFSET_MINUTES",
    DEFAULT_TIMEZONE_OFFSET_MINUTES,
  );
}

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isInteger(value) ? value : fallback;
}

function getLocalHour(now: Date) {
  const localNow = new Date(now.getTime() + getTimezoneOffsetMinutes() * 60 * 1000);
  return localNow.getUTCHours();
}

function getLocalMinutes(now: Date) {
  const localNow = new Date(now.getTime() + getTimezoneOffsetMinutes() * 60 * 1000);
  return localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
}

function getLocalDateOnly(now: Date, daysFromNow: number) {
  const offsetMs = getTimezoneOffsetMinutes() * 60 * 1000;
  const localDate = new Date(now.getTime() + offsetMs);
  localDate.setUTCHours(0, 0, 0, 0);
  localDate.setUTCDate(localDate.getUTCDate() + daysFromNow);

  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getReminderDays(reminderDaysBefore: number[], remindOnDayOf: boolean) {
  return [
    ...new Set([
      ...(remindOnDayOf ? [0] : []),
      ...reminderDaysBefore.filter((value) => Number.isInteger(value) && value > 0),
    ]),
  ].sort((left, right) => left - right);
}

function isWithinQuietHours(now: Date, start: string, end: string) {
  const startMinutes = parseTimeMinutes(start);
  const endMinutes = parseTimeMinutes(end);

  if (startMinutes === endMinutes) {
    return false;
  }

  const currentMinutes = getLocalMinutes(now);

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function parseTimeMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function buildReminderCopy(item: DueItem, daysBefore: number) {
  if (daysBefore === 0) {
    return {
      title: "오늘 유통기한이 끝나요",
      body: `${item.displayName}을 오늘 확인해주세요.`,
    };
  }

  return {
    title: `${daysBefore}일 뒤 유통기한이 끝나요`,
    body: `${item.displayName}의 유통기한이 ${daysBefore}일 남았어요.`,
  };
}

function isStalePending(updatedAt: Date, now: Date) {
  return updatedAt.getTime() <= now.getTime() - getStalePendingMs();
}

function toDeliveryUpdate(ticket: ExpoPushTicket) {
  if (ticket.status === "ok") {
    return {
      status: PushNotificationDeliveryStatus.sent,
      expoTicketId: ticket.id,
      sentAt: new Date(),
      receiptCheckedAt: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    status: PushNotificationDeliveryStatus.failed,
    errorCode: ticket.details?.error ?? "EXPO_PUSH_ERROR",
    errorMessage: ticket.message ?? "Expo Push API rejected the notification.",
  };
}
