import { ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let authService: {
    markOAuthAuthorizationRedirected: ReturnType<typeof vi.fn>;
  };
  let controller: HealthController;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
    };
    authService = {
      markOAuthAuthorizationRedirected: vi.fn(),
    };
    process.env.NODE_ENV = "test";
    delete process.env.APP_VERSION;
    delete process.env.GIT_SHA;
    controller = new HealthController(prisma as never, authService as never);
  });

  it("returns ok for liveness without touching the database", () => {
    expect(controller.getHealth()).toEqual({
      status: "ok",
      version: "0.1.0",
      gitSha: "unknown",
      env: "test",
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns ready when the database responds", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    await expect(controller.getReady()).resolves.toEqual({ status: "ready" });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it("returns 503 when the database is unavailable", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    await expect(controller.getReady()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("302-redirects only when state resolves to a server-stored return URI", async () => {
    authService.markOAuthAuthorizationRedirected.mockResolvedValue({
      state: "server-state",
      returnUri: "expirymate://oauth",
      provider: "kakao",
    });
    const response = {
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.oauthCallback(
      {
        code: "kakao-code",
        state: "server-state",
      },
      response as never,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      302,
      "expirymate://oauth?code=kakao-code&state=server-state",
    );
  });

  it("returns 400 and does not redirect code for unknown/tampered state", async () => {
    authService.markOAuthAuthorizationRedirected.mockResolvedValue(null);
    const response = {
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.oauthCallback(
      {
        code: "stolen-code",
        state: "https://auth.expo.io/@attacker/app",
      },
      response as never,
    );

    expect(response.redirect).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.type).toHaveBeenCalledWith("html");
    expect(response.send).toHaveBeenCalledOnce();
  });

  it("serves the HTML bridge with a baked deep link when auth params are absent", async () => {
    authService.markOAuthAuthorizationRedirected.mockResolvedValue({
      state: "server-state",
      returnUri: "expirymate://oauth",
      provider: "google",
    });
    const response = {
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.oauthCallback(
      {
        state: "server-state",
      },
      response as never,
    );

    expect(response.redirect).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.type).toHaveBeenCalledWith("html");
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining("expirymate://oauth?state=server-state"),
    );
  });
});
