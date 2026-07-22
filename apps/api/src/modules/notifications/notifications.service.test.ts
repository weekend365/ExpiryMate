import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

const managedEnvKeys = [
  "PUSH_REMINDER_DELIVERY_HOUR",
  "PUSH_REMINDER_TIMEZONE_OFFSET_MINUTES",
  "PUSH_REMINDER_STALE_PENDING_MINUTES",
  "PUSH_REMINDER_RECEIPT_MIN_AGE_MINUTES",
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
    process.env.PUSH_REMINDER_STALE_PENDING_MINUTES = "15";
    process.env.PUSH_REMINDER_RECEIPT_MIN_AGE_MINUTES = "5";
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
    mockLeaseAcquired(prisma);
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

    expect(stats.skippedByLock).toBe(false);
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
    expect(prisma.schedulerLease.deleteMany).toHaveBeenCalled();
  });

  it("skips the batch when another instance holds the lease", async () => {
    const { prisma, expoPush, service } = createService();
    prisma.$executeRaw.mockResolvedValue(0);
    prisma.schedulerLease.findUnique.mockResolvedValue({
      ownerId: "someone-else",
    });

    const stats = await service.runDueReminders(
      new Date("2026-06-07T01:00:00.000Z"),
    );

    expect(stats.skippedByLock).toBe(true);
    expect(expoPush.send).not.toHaveBeenCalled();
    expect(prisma.notificationPreference.findMany).not.toHaveBeenCalled();
  });

  it("disables a token when Expo reports DeviceNotRegistered", async () => {
    const { prisma, expoPush, service } = createService();
    mockLeaseAcquired(prisma);
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
    mockLeaseAcquired(prisma);
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
      updatedAt: new Date("2026-06-07T00:30:00.000Z"),
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
          reminderDate: new Date("2026-06-08T00:00:00.000Z"),
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

  it("retries stale pending deliveries left after a mid-send crash", async () => {
    const { prisma, expoPush, service } = createService();
    mockLeaseAcquired(prisma);
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.pushNotificationDelivery.findMany
      .mockResolvedValueOnce([]) // receipts query
      .mockResolvedValueOnce([
        {
          id: "delivery-stale",
          title: "1일 뒤 유통기한이 끝나요",
          body: "계란의 유통기한이 1일 남았어요.",
          inventoryItemId: "item-1",
          daysBefore: 1,
          updatedAt: new Date("2026-06-07T00:30:00.000Z"),
          pushToken: {
            id: "push-token-1",
            token: "ExpoPushToken[device-token]",
          },
        },
      ]);
    prisma.pushNotificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    expoPush.send.mockResolvedValue({
      status: "ok",
      id: "ticket-stale",
    });

    const stats = await service.runDueReminders(
      new Date("2026-06-07T01:00:00.000Z"),
    );

    expect(stats.stalePendingRetried).toBe(1);
    expect(stats.notificationsSent).toBe(1);
    expect(expoPush.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ExpoPushToken[device-token]",
        data: expect.objectContaining({
          inventoryItemId: "item-1",
        }),
      }),
    );
  });

  it("marks sent deliveries failed when Expo receipts report DeviceNotRegistered", async () => {
    const { prisma, expoPush, service } = createService();
    mockLeaseAcquired(prisma);
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.pushNotificationDelivery.findMany
      .mockResolvedValueOnce([
        {
          id: "delivery-sent",
          expoTicketId: "ticket-receipt",
          pushTokenId: "push-token-1",
        },
      ])
      .mockResolvedValueOnce([]); // stale pending
    expoPush.getReceipts.mockResolvedValue({
      "ticket-receipt": {
        status: "error",
        message: "Device is not registered.",
        details: {
          error: "DeviceNotRegistered",
        },
      },
    });

    const stats = await service.runDueReminders(
      new Date("2026-06-07T01:00:00.000Z"),
    );

    expect(stats.receiptsChecked).toBe(1);
    expect(stats.receiptsFailed).toBe(1);
    expect(stats.tokensDisabled).toBe(1);
    expect(prisma.pushNotificationDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-sent" },
      data: expect.objectContaining({
        status: "failed",
        errorCode: "DeviceNotRegistered",
        receiptCheckedAt: expect.any(Date),
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
      findMany: vi.fn().mockResolvedValue([]),
    },
    inventoryItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    pushNotificationDelivery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    schedulerLease: {
      findUnique: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const expoPush = {
    send: vi.fn(),
    getReceipts: vi.fn().mockResolvedValue({}),
  };

  return {
    prisma,
    expoPush,
    service: new NotificationsService(prisma as never, expoPush as never),
  };
}

function mockLeaseAcquired(prisma: {
  $executeRaw: ReturnType<typeof vi.fn>;
  schedulerLease: { findUnique: ReturnType<typeof vi.fn> };
}) {
  let acquiredOwnerId: string | undefined;

  prisma.$executeRaw.mockImplementation(
    async (...args: unknown[]) => {
      // Tagged template: (strings, key, ownerId, expiresAt, now, now, ownerId)
      acquiredOwnerId = args[2] as string;
      return 1;
    },
  );
  prisma.schedulerLease.findUnique.mockImplementation(async () => ({
    ownerId: acquiredOwnerId,
  }));
}

function restoreManagedEnv() {
  for (const [key, value] of originalEnv) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}
