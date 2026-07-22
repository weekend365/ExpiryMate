import { HttpException, HttpStatus } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthRateLimitService,
  readClientIp,
} from "./auth-rate-limit.service";

describe("AuthRateLimitService", () => {
  const originalLoginMax = process.env.AUTH_RATE_LIMIT_LOGIN_MAX;
  const originalStore = process.env.AUTH_RATE_LIMIT_STORE;

  beforeEach(() => {
    process.env.AUTH_RATE_LIMIT_STORE = "memory";
  });

  afterEach(() => {
    restoreEnv("AUTH_RATE_LIMIT_LOGIN_MAX", originalLoginMax);
    restoreEnv("AUTH_RATE_LIMIT_STORE", originalStore);
    vi.useRealTimers();
  });

  it("rejects requests after the IP limit is exceeded", async () => {
    const service = new AuthRateLimitService();
    const request = createRequest("203.0.113.10", { email: "user@example.com" });
    const policy = {
      name: "login",
      max: 2,
      windowSeconds: 60,
      bodyFields: ["email"],
    };

    await service.assertAllowed(policy, request);
    await service.assertAllowed(policy, request);

    await expect(service.assertAllowed(policy, request)).rejects.toBeInstanceOf(
      HttpException,
    );

    try {
      await service.assertAllowed(policy, request);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it("limits the same identity across different IPs", async () => {
    const service = new AuthRateLimitService();
    const policy = {
      name: "password_forgot",
      max: 2,
      windowSeconds: 60,
      bodyFields: ["email"],
    };

    await service.assertAllowed(
      policy,
      createRequest("203.0.113.10", { email: "A@EXAMPLE.COM" }),
    );
    await service.assertAllowed(
      policy,
      createRequest("203.0.113.11", { email: "a@example.com" }),
    );

    await expect(
      service.assertAllowed(
        policy,
        createRequest("203.0.113.12", { email: " a@example.com " }),
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("ignores spoofed X-Forwarded-For and uses request.ip", async () => {
    const service = new AuthRateLimitService();
    const policy = {
      name: "login",
      max: 2,
      windowSeconds: 60,
    };

    const requestA = {
      ip: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.1" },
      body: {},
    };
    const requestB = {
      ip: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.2" },
      body: {},
    };

    await service.assertAllowed(policy, requestA);
    await service.assertAllowed(policy, requestB);

    await expect(service.assertAllowed(policy, requestA)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it("does not wipe long-window keys when a short policy triggers cleanup", async () => {
    vi.useFakeTimers({ now: new Date("2026-07-22T00:00:00.000Z") });

    const service = new AuthRateLimitService();
    const longPolicy = {
      name: "login",
      max: 2,
      windowSeconds: 3600,
      bodyFields: ["email"],
    };
    const shortPolicy = {
      name: "password_forgot",
      max: 100,
      windowSeconds: 60,
    };

    await service.assertAllowed(
      longPolicy,
      createRequest("203.0.113.10", { email: "keep@example.com" }),
    );
    await service.assertAllowed(
      longPolicy,
      createRequest("203.0.113.10", { email: "keep@example.com" }),
    );

    // Past short windows and past the periodic cleanup interval, but still
    // inside the long login window — cleanup must use each key's own windowMs.
    vi.advanceTimersByTime(90_000);
    await service.assertAllowed(
      shortPolicy,
      createRequest("198.51.100.9", {}),
    );

    await expect(
      service.assertAllowed(
        longPolicy,
        createRequest("203.0.113.10", { email: "keep@example.com" }),
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("allows env overrides to disable a policy", async () => {
    process.env.AUTH_RATE_LIMIT_LOGIN_MAX = "0";
    const service = new AuthRateLimitService();
    const policy = {
      name: "login",
      max: 1,
      windowSeconds: 60,
      bodyFields: ["email"],
    };
    const request = createRequest("203.0.113.10", { email: "user@example.com" });

    await expect(
      (async () => {
        await service.assertAllowed(policy, request);
        await service.assertAllowed(policy, request);
        await service.assertAllowed(policy, request);
      })(),
    ).resolves.toBeUndefined();
  });

  it("treats empty env overrides as unset", async () => {
    process.env.AUTH_RATE_LIMIT_LOGIN_MAX = "";
    const service = new AuthRateLimitService();
    const policy = {
      name: "login",
      max: 1,
      windowSeconds: 60,
      bodyFields: ["email"],
    };
    const request = createRequest("203.0.113.10", { email: "user@example.com" });

    await service.assertAllowed(policy, request);

    await expect(service.assertAllowed(policy, request)).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it("shares counters through the database store", async () => {
    process.env.AUTH_RATE_LIMIT_STORE = "database";
    const counts = new Map<string, number>();

    const prisma = {
      $executeRaw: vi.fn(async (_strings: TemplateStringsArray, key: string) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }),
      authRateLimitBucket: {
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => ({
          hitCount: counts.get(where.key) ?? 0,
        })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };

    const service = new AuthRateLimitService(prisma as never);
    const policy = { name: "login", max: 2, windowSeconds: 60 };
    const request = createRequest("203.0.113.10", {});

    await service.assertAllowed(policy, request);
    await service.assertAllowed(policy, request);
    await expect(service.assertAllowed(policy, request)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });
});

describe("readClientIp", () => {
  it("prefers request.ip over forwarded headers", () => {
    expect(
      readClientIp({
        ip: "203.0.113.50",
        headers: {
          "x-forwarded-for": "198.51.100.1",
          "x-real-ip": "198.51.100.2",
        },
      }),
    ).toBe("203.0.113.50");
  });

  it("falls back to socket.remoteAddress", () => {
    expect(
      readClientIp({
        headers: { "x-forwarded-for": "198.51.100.1" },
        socket: { remoteAddress: "203.0.113.99" },
      }),
    ).toBe("203.0.113.99");
  });
});

function createRequest(ip: string, body: Record<string, unknown>) {
  return {
    ip,
    headers: {},
    body,
  };
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
