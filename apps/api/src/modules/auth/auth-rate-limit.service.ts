import { createHash } from "node:crypto";
import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { AuthRateLimitPolicy } from "./auth-rate-limit.decorator";

interface RateLimitedRequest {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class AuthRateLimitService {
  private readonly hitsByKey = new Map<string, number[]>();
  private lastCleanupAt = 0;

  assertAllowed(policy: AuthRateLimitPolicy, request: RateLimitedRequest) {
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
    const cutoff = now - windowMs;

    this.cleanup(now, cutoff);

    const states = this.buildKeys(policy, request).map((key) => ({
      key,
      hits: (this.hitsByKey.get(key) ?? []).filter(
        (timestamp) => timestamp > cutoff,
      ),
    }));
    const exceeded = states.find((state) => state.hits.length >= max);

    if (exceeded) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((exceeded.hits[0] ?? now) + windowMs - now) / 1000),
      );

      throw new HttpException(
        {
          message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    for (const state of states) {
      state.hits.push(now);
      this.hitsByKey.set(state.key, state.hits);
    }
  }

  reset() {
    this.hitsByKey.clear();
    this.lastCleanupAt = 0;
  }

  private buildKeys(policy: AuthRateLimitPolicy, request: RateLimitedRequest) {
    const keys = [`${policy.name}:ip:${hashValue(readClientIp(request))}`];
    const body = isRecord(request.body) ? request.body : {};

    for (const field of policy.bodyFields ?? []) {
      const rawValue = body[field];

      if (typeof rawValue !== "string" || !rawValue.trim()) {
        continue;
      }

      keys.push(`${policy.name}:${field}:${hashValue(normalizeIdentity(rawValue))}`);
    }

    return keys;
  }

  private cleanup(now: number, cutoff: number) {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return;
    }

    this.lastCleanupAt = now;

    for (const [key, hits] of this.hitsByKey.entries()) {
      const activeHits = hits.filter((timestamp) => timestamp > cutoff);

      if (activeHits.length === 0) {
        this.hitsByKey.delete(key);
        continue;
      }

      this.hitsByKey.set(key, activeHits);
    }
  }
}

function readClientIp(request: RateLimitedRequest) {
  return (
    readForwardedFor(request) ??
    readHeader(request, "x-real-ip") ??
    request.ip ??
    request.socket?.remoteAddress ??
    "unknown"
  );
}

function readForwardedFor(request: RateLimitedRequest) {
  const forwardedFor = readHeader(request, "x-forwarded-for");

  return forwardedFor?.split(",")[0]?.trim() || undefined;
}

function readHeader(request: RateLimitedRequest, key: string) {
  const value = request.headers[key];

  return Array.isArray(value) ? value[0] : value;
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
