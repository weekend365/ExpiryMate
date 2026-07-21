import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Query,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../../database/prisma.service";
import {
  buildInvalidOAuthCallbackHtml,
  buildOAuthCallbackHtml,
  buildOAuthDeepLink,
  canRedirectServerSide,
  type OAuthCallbackQuery,
} from "./oauth-callback";

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get("health")
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
   * Authorization-code providers return `?code=` so we 302 deep-link back
   * into the app using the server-stored return URI for `state` (never client-decoded).
   */
  @Get("oauth/callback")
  @Header("Cache-Control", "no-store")
  async oauthCallback(
    @Query() query: OAuthCallbackQuery,
    @Res() response: Response,
  ) {
    const session = await this.authService.markOAuthAuthorizationRedirected(
      query.state,
    );

    if (!session) {
      return response
        .status(HttpStatus.BAD_REQUEST)
        .type("html")
        .send(buildInvalidOAuthCallbackHtml());
    }

    const deepLink = buildOAuthDeepLink(session.returnUri, {
      ...query,
      state: session.state,
    });

    if (canRedirectServerSide(query)) {
      return response.redirect(HttpStatus.FOUND, deepLink);
    }

    return response
      .status(HttpStatus.OK)
      .type("html")
      .send(buildOAuthCallbackHtml(deepLink));
  }
}
