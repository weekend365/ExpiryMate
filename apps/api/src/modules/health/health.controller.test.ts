import { ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let controller: HealthController;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
    };
    controller = new HealthController(prisma as never);
  });

  it("returns ok for liveness without touching the database", () => {
    expect(controller.getHealth()).toEqual({ status: "ok" });
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
});
