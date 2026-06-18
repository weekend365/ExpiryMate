import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

const managedEnvKeys = [
  "PUSH_REMINDER_DELIVERY_HOUR",
  "PUSH_REMINDER_TIMEZONE_OFFSET_MINUTES",
] as const;

const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]]),
);

const pushTokenRecord = {
  id: "push-token-1",
  ownerKey: "owner-a",
  token: "ExpoPushToken[device-token]",
  platform: "ios",
  deviceId: null,
  appVersion: "1.0.0",
  enabled: true,
  lastSeenAt: new Date("2026-06-07T01:00:00.000Z"),
  disabledAt: null,
  createdAt: new Date("2026-06-07T01:00:00.000Z"),
  updatedAt: new Date("2026-06-07T01:00:00.000Z"),
};

const preference = {
  id: "preference-1",
  ownerKey: "owner-a",
  enabled: true,
  reminderDaysBefore: [1],
  remindOnDayOf: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  owner: {
    pushTokens: [
      {
        id: "push-token-1",
        token: "ExpoPushToken[device-token]",
      },
    ],
  },
};

const inventoryItem = {
  id: "item-1",
  displayName: "계란",
};

describe("NotificationsService", () => {
  beforeEach(() => {
    process.env.PUSH_REMINDER_DELIVERY_HOUR = "9";
    process.env.PUSH_REMINDER_TIMEZONE_OFFSET_MINUTES = "540";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreManagedEnv();
  });

  it("upserts an Expo push token for the current owner", async () => {
    const { prisma, service } = createService();
    prisma.pushToken.upsert.mockResolvedValue(pushTokenRecord);

    const result = await service.registerPushToken("owner-a", {
      token: "ExpoPushToken[device-token]",
      platform: "ios",
      appVersion: "1.0.0",
    });

    expect(result.token).toBe("ExpoPushToken[device-token]");
    expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
      where: {
        token: "ExpoPushToken[device-token]",
      },
      update: expect.objectContaining({
        ownerKey: "owner-a",
        platform: "ios",
        enabled: true,
        disabledAt: null,
        appVersion: "1.0.0",
      }),
      create: expect.objectContaining({
        ownerKey: "owner-a",
        token: "ExpoPushToken[device-token]",
        platform: "ios",
        enabled: true,
        appVersion: "1.0.0",
      }),
    });
  });

  it("sends a due expiry reminder once per token and item", async () => {
    const { prisma, expoPush, service } = createService();
    prisma.notificationPreference.findMany.mockResolvedValue([preference]);
    prisma.inventoryItem.findMany.mockResolvedValue([inventoryItem]);
    prisma.pushNotificationDelivery.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "delivery-1",
        ...data,
      }),
    );
    expoPush.send.mockResolvedValue({
      status: "ok",
      id: "ticket-1",
    });

    const stats = await service.runDueReminders(
      new Date("2026-06-07T01:00:00.000Z"),
    );

    expect(stats.notificationsCreated).toBe(1);
    expect(stats.notificationsSent).toBe(1);
    expect(expoPush.send).toHaveBeenCalledWith({
      to: "ExpoPushToken[device-token]",
      title: "1일 뒤 유통기한이 끝나요",
      body: "계란의 유통기한이 1일 남았어요.",
      data: {
        type: "expiry_reminder",
        inventoryItemId: "item-1",
        daysBefore: 1,
      },
    });
    expect(prisma.pushNotificationDelivery.update).toHaveBeenCalledWith({
      where: {
        id: "delivery-1",
      },
      data: expect.objectContaining({
        status: "sent",
        expoTicketId: "ticket-1",
      }),
    });
  });

  it("disables a token when Expo reports DeviceNotRegistered", async () => {
    const { prisma, expoPush, service } = createService();
    prisma.notificationPreference.findMany.mockResolvedValue([preference]);
    prisma.inventoryItem.findMany.mockResolvedValue([inventoryItem]);
    prisma.pushNotificationDelivery.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "delivery-1",
        ...data,
      }),
    );
    expoPush.send.mockResolvedValue({
      status: "error",
      message: "Device is not registered.",
      details: {
        error: "DeviceNotRegistered",
      },
    });

    const stats = await service.runDueReminders(
      new Date("2026-06-07T01:00:00.000Z"),
    );

    expect(stats.notificationsFailed).toBe(1);
    expect(stats.tokensDisabled).toBe(1);
    expect(prisma.pushToken.update).toHaveBeenCalledWith({
      where: {
        id: "push-token-1",
      },
      data: expect.objectContaining({
        enabled: false,
      }),
    });
  });

  it("retries a previously failed delivery when the duplicate guard is hit", async () => {
    const { prisma, expoPush, service } = createService();
    const duplicateError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
      },
    );
    prisma.notificationPreference.findMany.mockResolvedValue([preference]);
    prisma.inventoryItem.findMany.mockResolvedValue([inventoryItem]);
    prisma.pushNotificationDelivery.create.mockRejectedValueOnce(duplicateError);
    prisma.pushNotificationDelivery.findUnique.mockResolvedValue({
      id: "delivery-1",
      status: "failed",
      attempts: 1,
    });
    prisma.pushNotificationDelivery.update
      .mockResolvedValueOnce({
        id: "delivery-1",
        title: "1일 뒤 유통기한이 끝나요",
        body: "계란의 유통기한이 1일 남았어요.",
      })
      .mockResolvedValueOnce({
        id: "delivery-1",
        status: "sent",
      });
    expoPush.send.mockResolvedValue({
      status: "ok",
      id: "ticket-1",
    });

    const stats = await service.runDueReminders(
      new Date("2026-06-07T01:00:00.000Z"),
    );

    expect(stats.notificationsCreated).toBe(1);
    expect(stats.notificationsSent).toBe(1);
    expect(prisma.pushNotificationDelivery.findUnique).toHaveBeenCalledWith({
      where: {
        pushTokenId_inventoryItemId_reminderDate_daysBefore: {
          pushTokenId: "push-token-1",
          inventoryItemId: "item-1",
          reminderDate: new Date("2026-06-07T15:00:00.000Z"),
          daysBefore: 1,
        },
      },
    });
    expect(prisma.pushNotificationDelivery.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "delivery-1",
      },
      data: expect.objectContaining({
        status: "pending",
        attempts: {
          increment: 1,
        },
        errorCode: null,
        errorMessage: null,
      }),
    });
  });
});

function createService() {
  const prisma = {
    pushToken: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
    },
    inventoryItem: {
      findMany: vi.fn(),
    },
    pushNotificationDelivery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const expoPush = {
    send: vi.fn(),
  };

  return {
    prisma,
    expoPush,
    service: new NotificationsService(prisma as never, expoPush as never),
  };
}

function restoreManagedEnv() {
  for (const [key, value] of originalEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
