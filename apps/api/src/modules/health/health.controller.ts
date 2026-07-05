import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  @HttpCode(HttpStatus.OK)
  getHealth() {
    return {
      status: "ok",
      version: process.env.APP_VERSION ?? "0.1.0",
      gitSha: process.env.GIT_SHA ?? "unknown",
      env: process.env.NODE_ENV ?? "development",
    };
  }

  @Get("ready")
  async getReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException({
        status: "not_ready",
        message: "Database is unavailable.",
      });
    }
  }
}
