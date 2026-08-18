import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AffiliateReportSyncService,
  aggregateReportRows,
  splitDateWindows,
} from "./affiliate-report-sync.service";

const previousReportSyncEnabled = process.env.COUPANG_REPORT_SYNC_ENABLED;

afterEach(() => {
  if (previousReportSyncEnabled === undefined) {
    delete process.env.COUPANG_REPORT_SYNC_ENABLED;
  } else {
    process.env.COUPANG_REPORT_SYNC_ENABLED = previousReportSyncEnabled;
  }
});

describe("affiliate report synchronization helpers", () => {
  it("aggregates daily report rows without user attribution", () => {
    const result = aggregateReportRows([
      {
        date: "20260817",
        trackingCode: "AF123",
        subId: "app",
        click: 4,
        order: 1,
        cancel: 0,
        gmv: 10000,
        commission: 300,
      },
      {
        date: "20260817",
        trackingCode: "AF123",
        subId: "app",
        click: 2,
        order: 1,
        cancel: 1,
        gmv: 5000,
        commission: -100,
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        trackingCode: "AF123",
        subId: "app",
        clicks: 6,
        orders: 2,
        cancels: 1,
        gmvKrw: 15000,
        commissionKrw: 200,
      }),
    ]);
  });

  it("splits a 90-day backfill into API-safe windows", () => {
    const windows = splitDateWindows(
      new Date("2026-05-20T00:00:00.000Z"),
      new Date("2026-08-17T00:00:00.000Z"),
      30,
    );

    expect(windows).toHaveLength(3);
    expect(windows[0]?.start.toISOString().slice(0, 10)).toBe("2026-05-20");
    expect(windows[2]?.end.toISOString().slice(0, 10)).toBe("2026-08-17");
  });

  it("stores a zero-value sync marker when the report has no rows", async () => {
    process.env.COUPANG_REPORT_SYNC_ENABLED = "true";
    const prisma = {
      affiliateReportDaily: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      schedulerLease: {
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const coupang = {
      hasCredentials: vi.fn().mockReturnValue(true),
      getReport: vi.fn().mockResolvedValue([]),
    };
    const service = new AffiliateReportSyncService(
      prisma as never,
      coupang as never,
    );
    prisma.schedulerLease.findUnique.mockResolvedValue({
      ownerId: Reflect.get(service, "leaseOwnerId"),
    });

    const result = await service.runSync(new Date("2026-08-18T07:00:00.000Z"));

    expect(result).toMatchObject({ syncedRows: 0 });
    expect(coupang.getReport).toHaveBeenCalledTimes(3);
    expect(prisma.affiliateReportDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          trackingCode: "__sync_marker__",
          clicks: 0,
        }),
      }),
    );
  });

  it("upserts cancellation corrections from a rolling report window", async () => {
    process.env.COUPANG_REPORT_SYNC_ENABLED = "true";
    const prisma = {
      affiliateReportDaily: {
        findFirst: vi.fn().mockResolvedValue({
          lastSyncedAt: new Date("2026-08-17T07:00:00.000Z"),
        }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      schedulerLease: {
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const coupang = {
      hasCredentials: vi.fn().mockReturnValue(true),
      getReport: vi
        .fn()
        .mockResolvedValueOnce([
          {
            date: "20260817",
            trackingCode: "AF123",
            subId: "app",
            click: 5,
            order: 2,
            cancel: 1,
            gmv: 12000,
            commission: 240,
          },
        ])
        .mockResolvedValue([]),
    };
    const service = new AffiliateReportSyncService(
      prisma as never,
      coupang as never,
    );
    prisma.schedulerLease.findUnique.mockResolvedValue({
      ownerId: Reflect.get(service, "leaseOwnerId"),
    });

    const result = await service.runSync(new Date("2026-08-18T07:00:00.000Z"));

    expect(result).toMatchObject({ syncedRows: 1 });
    expect(coupang.getReport).toHaveBeenCalledTimes(2);
    expect(prisma.affiliateReportDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ cancels: 1 }),
        create: expect.objectContaining({ cancels: 1 }),
      }),
    );
  });

  it("skips synchronization when another process owns the lease", async () => {
    process.env.COUPANG_REPORT_SYNC_ENABLED = "true";
    const prisma = {
      affiliateReportDaily: { findFirst: vi.fn().mockResolvedValue(null) },
      schedulerLease: {
        findUnique: vi.fn().mockResolvedValue({ ownerId: "another-process" }),
      },
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    const coupang = {
      hasCredentials: vi.fn().mockReturnValue(true),
      getReport: vi.fn(),
    };
    const service = new AffiliateReportSyncService(
      prisma as never,
      coupang as never,
    );

    await expect(
      service.runSync(new Date("2026-08-18T07:00:00.000Z")),
    ).resolves.toMatchObject({ skippedByLock: true });
    expect(coupang.getReport).not.toHaveBeenCalled();
  });
});
