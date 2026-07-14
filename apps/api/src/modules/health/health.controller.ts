import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Res,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../../database/prisma.service";

const OAUTH_CALLBACK_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>로그인 연결 중</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f1f3f5;
      color: #1a1f27;
      text-align: center;
      padding: 24px;
    }
    p { color: #4e5561; line-height: 1.5; }
  </style>
</head>
<body>
  <div>
    <h1>거의 다 됐어요</h1>
    <p id="status">앱으로 돌아가는 중이에요…</p>
  </div>
  <script>
    (function () {
      var search = window.location.search || "";
      var hash = window.location.hash || "";
      var query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      var fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      var rawReturn = fragment.get("state") || query.get("state") || "expirymate://oauth";
      var returnUri = rawReturn;
      try { returnUri = decodeURIComponent(rawReturn); } catch (e) {}
      if (!/^expirymate:\\/\\//.test(returnUri) && !/^exp:\\/\\//.test(returnUri)) {
        returnUri = "expirymate://oauth";
      }
      try {
        window.location.replace(returnUri + search + hash);
      } catch (e) {
        document.getElementById("status").textContent =
          "앱으로 돌아가지 못했어요. 앱에서 다시 이어가 주세요.";
      }
    })();
  </script>
</body>
</html>`;

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
   * This page deep-links back into the app so WebBrowser can finish the session.
   */
  @Get("oauth/callback")
  @Header("Cache-Control", "no-store")
  oauthCallback(@Res() response: Response) {
    response.status(HttpStatus.OK).type("html").send(OAUTH_CALLBACK_HTML);
  }
}
