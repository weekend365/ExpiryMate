import { HttpException, HttpStatus } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { AuthRateLimitService } from "./auth-rate-limit.service";

describe("AuthRateLimitService", () => {
  const originalLoginMax = process.env.AUTH_RATE_LIMIT_LOGIN_MAX;

  afterEach(() => {
    restoreEnv("AUTH_RATE_LIMIT_LOGIN_MAX", originalLoginMax);
  });

  it("rejects requests after the IP limit is exceeded", () => {
    const service = new AuthRateLimitService();
    const request = createRequest("203.0.113.10", { email: "user@example.com" });

    service.assertAllowed(
      { name: "login", max: 2, windowSeconds: 60, bodyFields: ["email"] },
      request,
    );
    service.assertAllowed(
      { name: "login", max: 2, windowSeconds: 60, bodyFields: ["email"] },
      request,
    );

    expect(() =>
      service.assertAllowed(
        { name: "login", max: 2, windowSeconds: 60, bodyFields: ["email"] },
        request,
      ),
    ).toThrow(HttpException);

    try {
      service.assertAllowed(
        { name: "login", max: 2, windowSeconds: 60, bodyFields: ["email"] },
        request,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it("limits the same identity across different IPs", () => {
    const service = new AuthRateLimitService();
    const policy = {
      name: "password_forgot",
      max: 2,
      windowSeconds: 60,
      bodyFields: ["email"],
    };

    service.assertAllowed(policy, createRequest("203.0.113.10", { email: "A@EXAMPLE.COM" }));
    service.assertAllowed(policy, createRequest("203.0.113.11", { email: "a@example.com" }));

    expect(() =>
      service.assertAllowed(
        policy,
        createRequest("203.0.113.12", { email: " a@example.com " }),
      ),
    ).toThrow(HttpException);
  });

  it("allows env overrides to disable a policy", () => {
    process.env.AUTH_RATE_LIMIT_LOGIN_MAX = "0";
    const service = new AuthRateLimitService();
    const policy = {
      name: "login",
      max: 1,
      windowSeconds: 60,
      bodyFields: ["email"],
    };
    const request = createRequest("203.0.113.10", { email: "user@example.com" });

    expect(() => {
      service.assertAllowed(policy, request);
      service.assertAllowed(policy, request);
      service.assertAllowed(policy, request);
    }).not.toThrow();
  });

  it("treats empty env overrides as unset", () => {
    process.env.AUTH_RATE_LIMIT_LOGIN_MAX = "";
    const service = new AuthRateLimitService();
    const policy = {
      name: "login",
      max: 1,
      windowSeconds: 60,
      bodyFields: ["email"],
    };
    const request = createRequest("203.0.113.10", { email: "user@example.com" });

    service.assertAllowed(policy, request);

    expect(() => service.assertAllowed(policy, request)).toThrow(HttpException);
  });
});

function createRequest(ip: string, body: Record<string, unknown>) {
  return {
    headers: {
      "x-forwarded-for": ip,
    },
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
