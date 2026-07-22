import { createHash } from "node:crypto";
import { HttpException, HttpStatus, Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuthRateLimitPolicy } from "./auth-rate-limit.decorator";

interface RateLimitedRequest {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

interface MemoryBucket {
  hits: number[];
  /** Window length used when recording hits — cleanup must not reuse another policy's cutoff. */
  windowMs: number;
}

const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class AuthRateLimitService {
  private readonly memoryBuckets = new Map<string, MemoryBucket>();
  private lastMemoryCleanupAt = 0;
  private lastDbCleanupAt = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async assertAllowed(policy: AuthRateLimitPolicy, request: RateLimitedRequest) {
    const max = readPositiveIntegerEnv(
      `AUTH_RATE_LIMIT_${toEnvName(policy.name)}_MAX`,
      policy.max,
    );
    const windowSeconds = readPositiveIntegerEnv(
      `AUTH_RATE_LIMIT_${toEnvName(policy.name)}_WINDOW_SECONDS`,
      policy.windowSeconds,
    );

    if (max === 0 || windowSeconds === 0) {
      return;
    }

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const keys = this.buildKeys(policy, request);

    if (this.shouldUseDatabase()) {
      await this.assertAllowedWithDatabase(keys, max, windowMs, now);
      return;
    }

    this.assertAllowedInMemory(keys, max, windowMs, now);
  }

  reset() {
    this.memoryBuckets.clear();
    this.lastMemoryCleanupAt = 0;
    this.lastDbCleanupAt = 0;
  }

  private shouldUseDatabase() {
    if (process.env.AUTH_RATE_LIMIT_STORE === "memory") {
      return false;
    }

    if (process.env.AUTH_RATE_LIMIT_STORE === "database") {
      return Boolean(this.prisma);
    }

    return Boolean(this.prisma);
  }

  private assertAllowedInMemory(
    keys: string[],
    max: number,
    windowMs: number,
    now: number,
  ) {
    this.cleanupMemory(now);

    const states = keys.map((key) => {
      const bucket = this.memoryBuckets.get(key);
      const cutoff = now - windowMs;
      const hits = (bucket?.hits ?? []).filter((timestamp) => timestamp > cutoff);
      return { key, hits };
    });
    const exceeded = states.find((state) => state.hits.length >= max);

    if (exceeded) {
      throwTooManyRequests(exceeded.hits[0] ?? now, windowMs, now);
    }

    for (const state of states) {
      state.hits.push(now);
      this.memoryBuckets.set(state.key, {
        hits: state.hits,
        windowMs,
      });
    }
  }

  private async assertAllowedWithDatabase(
    keys: string[],
    max: number,
    windowMs: number,
    now: number,
  ) {
    if (!this.prisma) {
      this.assertAllowedInMemory(keys, max, windowMs, now);
      return;
    }

    await this.cleanupDatabase(now);
    const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs);
    const counts: Array<{ key: string; hitCount: number }> = [];

    for (const key of keys) {
      const hitCount = await this.incrementDatabaseBucket(key, windowStartedAt);
      counts.push({ key, hitCount });
    }

    const exceeded = counts.find((state) => state.hitCount > max);
    if (exceeded) {
      throwTooManyRequests(windowStartedAt.getTime(), windowMs, now);
    }
  }

  private async incrementDatabaseBucket(key: string, windowStartedAt: Date) {
    if (!this.prisma) {
      return 0;
    }

    // Atomic fixed-window counter shared across API replicas.
    await this.prisma.$executeRaw`
      INSERT INTO "AuthRateLimitBucket" ("key", "windowStartedAt", "hitCount", "updatedAt")
      VALUES (${key}, ${windowStartedAt}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO UPDATE SET
        "hitCount" = CASE
          WHEN "AuthRateLimitBucket"."windowStartedAt" = ${windowStartedAt}
          THEN "AuthRateLimitBucket"."hitCount" + 1
          ELSE 1
        END,
        "windowStartedAt" = ${windowStartedAt},
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    const bucket = await this.prisma.authRateLimitBucket.findUnique({
      where: { key },
      select: { hitCount: true },
    });

    return bucket?.hitCount ?? 0;
  }

  private buildKeys(policy: AuthRateLimitPolicy, request: RateLimitedRequest) {
    const keys = [`${policy.name}:ip:${hashValue(readClientIp(request))}`];
    const body = isRecord(request.body) ? request.body : {};

    for (const field of policy.bodyFields ?? []) {
      const rawValue = body[field];

      if (typeof rawValue !== "string" || !rawValue.trim()) {
        continue;
      }

      keys.push(
        `${policy.name}:${field}:${hashValue(normalizeIdentity(rawValue))}`,
      );
    }

    return keys;
  }

  private cleanupMemory(now: number) {
    if (now - this.lastMemoryCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }

    this.lastMemoryCleanupAt = now;

    for (const [key, bucket] of this.memoryBuckets.entries()) {
      const cutoff = now - bucket.windowMs;
      const activeHits = bucket.hits.filter((timestamp) => timestamp > cutoff);

      if (activeHits.length === 0) {
        this.memoryBuckets.delete(key);
        continue;
      }

      this.memoryBuckets.set(key, {
        hits: activeHits,
        windowMs: bucket.windowMs,
      });
    }
  }

  private async cleanupDatabase(now: number) {
    if (!this.prisma || now - this.lastDbCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }

    this.lastDbCleanupAt = now;
    // Drop buckets whose window started more than 2 hours ago (covers longest policies).
    const staleBefore = new Date(now - 2 * 60 * 60 * 1000);
    await this.prisma.authRateLimitBucket.deleteMany({
      where: {
        windowStartedAt: {
          lt: staleBefore,
        },
      },
    });
  }
}

function throwTooManyRequests(
  oldestHitOrWindowStart: number,
  windowMs: number,
  now: number,
): never {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((oldestHitOrWindowStart + windowMs - now) / 1000),
  );

  throw new HttpException(
    {
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * Prefer Express `request.ip` (honors trust proxy). Never trust raw
 * X-Forwarded-For / X-Real-IP headers from the client socket.
 */
export function readClientIp(request: RateLimitedRequest) {
  return request.ip?.trim() || request.socket?.remoteAddress?.trim() || "unknown";
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toEnvName(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

function readPositiveIntegerEnv(key: string, fallback: number) {
  const rawValue = process.env[key];

  if (!rawValue?.trim()) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    return fallback;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
