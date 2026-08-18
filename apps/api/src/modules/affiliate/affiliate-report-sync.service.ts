import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import {
  CoupangPartnersClient,
  type CoupangReportRow,
} from "./coupang-partners.client";

const LEASE_KEY = "coupang_affiliate_report_sync";
const CHECK_INTERVAL_MS = 60 * 60_000;
const LEASE_TTL_MS = 30 * 60_000;
const REPORT_READY_HOUR_KST = 15;
const REPORT_READY_MINUTE_KST = 30;
const FIRST_SYNC_DAYS = 90;
const ROLLING_SYNC_DAYS = 35;
const MAX_REPORT_WINDOW_DAYS = 30;
const SYNC_MARKER_TRACKING_CODE = "__sync_marker__";

type DailyAggregate = {
  date: Date;
  trackingCode: string;
  subId: string;
  clicks: number;
  orders: number;
  cancels: number;
  gmvKrw: number;
  commissionKrw: number;
};

@Injectable()
export class AffiliateReportSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AffiliateReportSyncService.name);
  private readonly leaseOwnerId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupang: CoupangPartnersClient,
  ) {}

  onApplicationBootstrap() {
    if (!isReportSyncEnabled()) return;
    void this.runSync().catch((error: unknown) => {
      this.logger.error("Initial Coupang affiliate report sync failed", error);
    });
    this.timer = setInterval(() => {
      void this.runSync().catch((error: unknown) => {
        this.logger.error("Scheduled Coupang affiliate report sync failed", error);
      });
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    void this.prisma.schedulerLease.deleteMany({
      where: { key: LEASE_KEY, ownerId: this.leaseOwnerId },
    });
  }

  async runSync(now = new Date()) {
    if (!isReportSyncEnabled() || !this.coupang.hasCredentials()) {
      return { skippedByFlag: true as const, skippedByLock: false as const };
    }
    if (!isAfterReportReadyTime(now)) {
      return { skippedByFlag: false as const, skippedByLock: false as const, skippedByTime: true as const };
    }
    const last = await this.prisma.affiliateReportDaily.findFirst({
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    });
    if (last && toKstDateKey(last.lastSyncedAt) === toKstDateKey(now)) {
      return { skippedByFlag: false as const, skippedByLock: false as const, skippedAlreadyToday: true as const };
    }
    if (!(await this.tryAcquireLease(now))) {
      return { skippedByFlag: false as const, skippedByLock: true as const };
    }

    try {
      const lookbackDays = last ? ROLLING_SYNC_DAYS : FIRST_SYNC_DAYS;
      const end = addUtcDays(utcDateOnly(now), -1);
      const start = addUtcDays(end, -(lookbackDays - 1));
      const windows = splitDateWindows(start, end, MAX_REPORT_WINDOW_DAYS);
      let syncedRows = 0;
      for (const window of windows) {
        const rows = await this.fetchAllPages(window.start, window.end);
        const aggregates = aggregateReportRows(rows);
        for (const row of aggregates) {
          await this.prisma.affiliateReportDaily.upsert({
            where: {
              date_trackingCode_subId: {
                date: row.date,
                trackingCode: row.trackingCode,
                subId: row.subId,
              },
            },
            update: {
              clicks: row.clicks,
              orders: row.orders,
              cancels: row.cancels,
              gmvKrw: new Prisma.Decimal(row.gmvKrw),
              commissionKrw: new Prisma.Decimal(row.commissionKrw),
              lastSyncedAt: now,
            },
            create: {
              ...row,
              gmvKrw: new Prisma.Decimal(row.gmvKrw),
              commissionKrw: new Prisma.Decimal(row.commissionKrw),
              lastSyncedAt: now,
            },
          });
          syncedRows += 1;
        }
      }
      if (syncedRows === 0) {
        await this.prisma.affiliateReportDaily.upsert({
          where: {
            date_trackingCode_subId: {
              date: end,
              trackingCode: SYNC_MARKER_TRACKING_CODE,
              subId: "",
            },
          },
          update: { lastSyncedAt: now },
          create: {
            date: end,
            trackingCode: SYNC_MARKER_TRACKING_CODE,
            subId: "",
            clicks: 0,
            orders: 0,
            cancels: 0,
            gmvKrw: new Prisma.Decimal(0),
            commissionKrw: new Prisma.Decimal(0),
            lastSyncedAt: now,
          },
        });
      }
      this.logger.log(`Coupang affiliate report sync completed rows=${syncedRows}`);
      return {
        skippedByFlag: false as const,
        skippedByLock: false as const,
        syncedRows,
      };
    } finally {
      await this.prisma.schedulerLease.deleteMany({
        where: { key: LEASE_KEY, ownerId: this.leaseOwnerId },
      });
    }
  }

  private async fetchAllPages(start: Date, end: Date) {
    const all: CoupangReportRow[] = [];
    for (let page = 0; page < 100; page += 1) {
      const rows = await this.coupang.getReport({
        kind: "commission",
        startDate: formatReportDate(start),
        endDate: formatReportDate(end),
        page,
      });
      if (!rows) throw new Error("Coupang commission report is unavailable");
      all.push(...rows);
      if (rows.length < 1000) break;
    }
    return all;
  }

  private async tryAcquireLease(now: Date) {
    const expiresAt = new Date(now.getTime() + LEASE_TTL_MS);
    await this.prisma.$executeRaw`
      INSERT INTO "SchedulerLease" ("key", "ownerId", "expiresAt", "updatedAt")
      VALUES (${LEASE_KEY}, ${this.leaseOwnerId}, ${expiresAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "ownerId" = EXCLUDED."ownerId",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = EXCLUDED."updatedAt"
      WHERE "SchedulerLease"."expiresAt" < ${now}
         OR "SchedulerLease"."ownerId" = ${this.leaseOwnerId}
    `;
    const lease = await this.prisma.schedulerLease.findUnique({
      where: { key: LEASE_KEY },
      select: { ownerId: true },
    });
    return lease?.ownerId === this.leaseOwnerId;
  }
}

export function aggregateReportRows(rows: CoupangReportRow[]) {
  const result = new Map<string, DailyAggregate>();
  for (const row of rows) {
    const date = parseReportDate(row.date);
    if (!date) continue;
    const trackingCode = readString(row.trackingCode);
    const subId = readString(row.subId);
    const key = `${formatReportDate(date)}:${trackingCode}:${subId}`;
    const current = result.get(key) ?? {
      date,
      trackingCode,
      subId,
      clicks: 0,
      orders: 0,
      cancels: 0,
      gmvKrw: 0,
      commissionKrw: 0,
    };
    current.clicks += readNumber(row.click ?? row.clicks);
    current.orders += readNumber(row.order ?? row.orders);
    current.cancels += readNumber(row.cancel ?? row.cancels);
    current.gmvKrw += readNumber(row.gmv);
    current.commissionKrw += readNumber(row.commission);
    result.set(key, current);
  }
  return [...result.values()];
}

export function splitDateWindows(start: Date, end: Date, maxDays: number) {
  const windows: Array<{ start: Date; end: Date }> = [];
  let cursor = start;
  while (cursor <= end) {
    const windowEnd = new Date(
      Math.min(addUtcDays(cursor, maxDays - 1).getTime(), end.getTime()),
    );
    windows.push({ start: cursor, end: windowEnd });
    cursor = addUtcDays(windowEnd, 1);
  }
  return windows;
}

function isReportSyncEnabled() {
  return process.env.COUPANG_REPORT_SYNC_ENABLED?.trim().toLowerCase() === "true";
}

function isAfterReportReadyTime(now: Date) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return hour > REPORT_READY_HOUR_KST ||
    (hour === REPORT_READY_HOUR_KST && minute >= REPORT_READY_MINUTE_KST);
}

function toKstDateKey(value: Date) {
  const shifted = new Date(value.getTime() + 9 * 60 * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function utcDateOnly(value: Date) {
  const shifted = new Date(value.getTime() + 9 * 60 * 60_000);
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ));
}

function parseReportDate(value: unknown) {
  const raw = readString(value).replaceAll("-", "");
  if (!/^\d{8}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatReportDate(value: Date) {
  return value.toISOString().slice(0, 10).replaceAll("-", "");
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60_000);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
