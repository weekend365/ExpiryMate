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
import { ExpoPushService, type ExpoPushTicket } from "./expo-push.service";

const DEFAULT_INTERVAL_MINUTES = 30;
const DEFAULT_DELIVERY_HOUR = 9;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEZONE_OFFSET_MINUTES = 9 * 60;

interface ReminderStats {
  preferencesChecked: number;
  itemsMatched: number;
  notificationsCreated: number;
  notificationsSent: number;
  notificationsFailed: number;
  tokensDisabled: number;
  skippedByTime: boolean;
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
      skippedByTime: false,
    };

    if (getLocalHour(now) < getDeliveryHour()) {
      stats.skippedByTime = true;
      return stats;
    }

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
            const ticket = await this.expoPush.send({
              to: pushToken.token,
              title: delivery.title,
              body: delivery.body,
              data: {
                type: "expiry_reminder",
                inventoryItemId: item.id,
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
            } else {
              stats.notificationsFailed += 1;

              if (ticket.details?.error === "DeviceNotRegistered") {
                await this.prisma.pushToken.update({
                  where: { id: pushToken.id },
                  data: {
                    enabled: false,
                    disabledAt: new Date(),
                  },
                });
                stats.tokensDisabled += 1;
              }
            }
          }
        }
      }
    }

    return stats;
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

        if (
          existing?.status === PushNotificationDeliveryStatus.failed &&
          existing.attempts < getMaxAttempts()
        ) {
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
            },
          });
        }

        return null;
      }

      throw error;
    }
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

function toDeliveryUpdate(ticket: ExpoPushTicket) {
  if (ticket.status === "ok") {
    return {
      status: PushNotificationDeliveryStatus.sent,
      expoTicketId: ticket.id,
      sentAt: new Date(),
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
