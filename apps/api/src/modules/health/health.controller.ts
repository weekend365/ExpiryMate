import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../../database/prisma.service";
import {
  buildOAuthCallbackHtml,
  buildOAuthDeepLink,
  canRedirectServerSide,
  resolveOAuthReturnUri,
  type OAuthCallbackQuery,
} from "./oauth-callback";

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

  /**
   * Kakao/Naver/Google only allow http(s) Redirect URIs.
   * Query-based providers (Kakao/Naver) get a 302 deep link so the in-app
   * auth session can finish; hash-based Google still needs the HTML bridge.
   */
  @Get("oauth/callback")
  @Header("Cache-Control", "no-store")
  oauthCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() response: Response,
  ) {
    if (canRedirectServerSide(query)) {
      const deepLink = buildOAuthDeepLink(resolveOAuthReturnUri(query.state), query);
      return response.redirect(HttpStatus.FOUND, deepLink);
    }

    return response.status(HttpStatus.OK).type("html").send(buildOAuthCallbackHtml());
  }
}
