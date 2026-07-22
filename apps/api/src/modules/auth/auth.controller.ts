import {
  BadRequestException,
  Body,
  Controller,
  Get,
  GoneException,
  Header,
  Headers,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { RegisteredGuard } from "./registered.guard";
import { OAuthProvider } from "@prisma/client";
import type { Response } from "express";
import { AuthRateLimit } from "./auth-rate-limit.decorator";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import {
  buildDesktopVerifyEmailResultHtml,
  buildInvalidAuthLinkHtml,
  buildMobileVerifyEmailBridgeHtml,
  buildResetPasswordBridgeHtml,
  isMobileUserAgent,
} from "./auth-bridge";
import { AuthService } from "./auth.service";
import { CurrentOwnerKey } from "./current-owner-key.decorator";
import {
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  OAuthLoginDto,
  RefreshDto,
  RegisterDto,
  RequestEmailVerificationDto,
  ResetPasswordDto,
  StartOAuthDto,
  VerifyEmailDto,
} from "./dto/auth.dto";
import type { AuthenticatedRequest } from "./auth.types";
import { ensureAdminClientAllowed } from "./admin-client-session";

interface CookieResponse {
  setHeader(name: string, value: string | string[]): void;
}

@Controller("auth")
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Closed: anonymous sessions are no longer issued (P0-04). */
  @Post("anonymous")
  issueAnonymousSession() {
    throw new GoneException(
      "익명으로 이어가기는 더 이상 지원하지 않아요. 계정으로 로그인해 주세요.",
    );
  }

  @AuthRateLimit({
    name: "register",
    max: 5,
    windowSeconds: 600,
    bodyFields: ["email"],
  })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = await this.authService.getOptionalUserFromBearer(
      readAuthorization(request),
    );

    return this.authService.register(dto, actor);
  }

  /**
   * HTTPS bridge for email clients.
   * Mobile UA → deep-link into the app (token unused until the app verifies).
   * Desktop UA → confirm verification server-side, then ask the user to log in on the app.
   */
  @Get("verify-email")
  @Header("Cache-Control", "no-store")
  async bridgeVerifyEmail(
    @Query("token") token: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
    @Res() response: Response,
  ) {
    const trimmed = token?.trim();

    if (!trimmed) {
      return response
        .status(HttpStatus.BAD_REQUEST)
        .type("html")
        .send(buildInvalidAuthLinkHtml());
    }

    if (isMobileUserAgent(userAgent)) {
      return response
        .status(HttpStatus.OK)
        .type("html")
        .send(buildMobileVerifyEmailBridgeHtml(trimmed));
    }

    try {
      await this.authService.confirmEmailVerification(trimmed);
      return response
        .status(HttpStatus.OK)
        .type("html")
        .send(buildDesktopVerifyEmailResultHtml({ ok: true }));
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? readExceptionMessage(error)
          : undefined;

      return response
        .status(HttpStatus.OK)
        .type("html")
        .send(buildDesktopVerifyEmailResultHtml({ ok: false, message }));
    }
  }

  @Get("reset-password")
  @Header("Cache-Control", "no-store")
  bridgeResetPassword(
    @Query("token") token: string | undefined,
    @Res() response: Response,
  ) {
    const trimmed = token?.trim();

    if (!trimmed) {
      return response
        .status(HttpStatus.BAD_REQUEST)
        .type("html")
        .send(buildInvalidAuthLinkHtml());
    }

    return response
      .status(HttpStatus.OK)
      .type("html")
      .send(buildResetPasswordBridgeHtml(trimmed));
  }

  @AuthRateLimit({
    name: "login",
    max: 10,
    windowSeconds: 300,
    bodyFields: ["email"],
  })
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    const actor = await this.authService.getOptionalUserFromBearer(
      readAuthorization(request),
    );
    const session = await this.authService.login(dto, actor);

    return finalizeSessionForClient(this.authService, session, client, response);
  }

  @AuthRateLimit({
    name: "refresh",
    max: 30,
    windowSeconds: 60,
    bodyFields: ["refreshToken"],
  })
  @Post("refresh")
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshCookie(request);
    const session = await this.authService.refresh(refreshToken ?? "");

    return finalizeSessionForClient(this.authService, session, client, response);
  }

  @Post("logout")
  async logout(
    @Body() dto: LogoutDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshCookie(request);

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    clearRefreshCookie(response);
    return { ok: true };
  }

  @UseGuards(RegisteredGuard)
  @Get("me")
  getMe(@CurrentOwnerKey() ownerKey: string) {
    return this.authService.getMe(ownerKey);
  }

  @AuthRateLimit({
    name: "email_verify_request",
    max: 3,
    windowSeconds: 900,
    bodyFields: ["email"],
  })
  @Post("email/verify/request")
  async requestEmailVerification(
    @Body() dto: RequestEmailVerificationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = await this.authService.getOptionalUserFromBearer(
      readAuthorization(request),
    );

    return this.authService.requestEmailVerification(actor?.userId, dto.email);
  }

  @AuthRateLimit({
    name: "email_verify_status",
    max: 60,
    windowSeconds: 60,
  })
  @Get("email/verification-status")
  getEmailVerificationStatus(@Query("email") email: string | undefined) {
    if (!email?.trim()) {
      return { verified: false };
    }

    return this.authService.getEmailVerificationStatus(email);
  }

  @AuthRateLimit({
    name: "email_verify",
    // Token verify is idempotent-ish; allow retries after deep-link / remount noise.
    max: 30,
    windowSeconds: 300,
    bodyFields: ["token"],
  })
  @Post("email/verify")
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    const session = await this.authService.verifyEmail(dto.token);

    return formatSessionForClient(session, client, response);
  }

  @AuthRateLimit({
    name: "password_forgot",
    max: 3,
    windowSeconds: 900,
    bodyFields: ["email"],
  })
  @Post("password/forgot")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @AuthRateLimit({
    name: "password_reset",
    max: 5,
    windowSeconds: 900,
    bodyFields: ["token"],
  })
  @Post("password/reset")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @AuthRateLimit({
    name: "oauth_start",
    max: 30,
    windowSeconds: 300,
    bodyFields: ["provider", "returnUri"],
  })
  @Post("oauth/start")
  startOAuth(@Body() dto: StartOAuthDto) {
    return this.authService.startOAuthAuthorization(dto);
  }

  @AuthRateLimit({
    name: "oauth_apple",
    max: 20,
    windowSeconds: 300,
    bodyFields: ["providerToken"],
  })
  @Post("oauth/apple")
  oauthApple(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.apple, dto, request, response, client);
  }

  @AuthRateLimit({
    name: "oauth_google",
    max: 20,
    windowSeconds: 300,
    bodyFields: ["providerToken"],
  })
  @Post("oauth/google")
  oauthGoogle(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.google, dto, request, response, client);
  }

  @AuthRateLimit({
    name: "oauth_kakao",
    max: 20,
    windowSeconds: 300,
    bodyFields: ["providerToken"],
  })
  @Post("oauth/kakao")
  oauthKakao(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.kakao, dto, request, response, client);
  }

  @AuthRateLimit({
    name: "oauth_naver",
    max: 20,
    windowSeconds: 300,
    bodyFields: ["providerToken"],
  })
  @Post("oauth/naver")
  oauthNaver(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.naver, dto, request, response, client);
  }

  @Get("placeholder")
  getPlaceholderSession() {
    return {
      message: "인증은 /auth/login, /auth/register, /auth/oauth/* 를 사용합니다.",
    };
  }

  private async oauth(
    provider: OAuthProvider,
    dto: OAuthLoginDto,
    request: AuthenticatedRequest,
    response: CookieResponse,
    client?: string,
  ) {
    const actor = await this.authService.getOptionalUserFromBearer(
      readAuthorization(request),
    );
    const session = await this.authService.oauthLogin(provider, dto, actor);

    return finalizeSessionForClient(this.authService, session, client, response);
  }
}

async function finalizeSessionForClient(
  authService: AuthService,
  session: Awaited<ReturnType<AuthService["login"]>>,
  client: string | undefined,
  response: CookieResponse,
) {
  await ensureAdminClientAllowed(authService, session, client, () => {
    clearRefreshCookie(response);
  });

  return formatSessionForClient(session, client, response);
}

function formatSessionForClient(
  session: Awaited<ReturnType<AuthService["login"]>>,
  client: string | undefined,
  response: CookieResponse,
) {
  if (client === "admin" && session.refreshToken) {
    setRefreshCookie(response, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  return session;
}

function readExceptionMessage(error: BadRequestException) {
  const payload = error.getResponse();

  if (typeof payload === "string") {
    return payload;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload
  ) {
    const message = (payload as { message?: string | string[] }).message;
    if (Array.isArray(message)) {
      return message[0];
    }
    if (typeof message === "string") {
      return message;
    }
  }

  return error.message;
}

function readAuthorization(request: AuthenticatedRequest) {
  const value = request.headers.authorization;

  return Array.isArray(value) ? value[0] : value;
}

function readRefreshCookie(request: AuthenticatedRequest) {
  const cookieHeader = request.headers.cookie;
  const cookies = (Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader) ?? "";
  const refreshCookie = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("expiry_admin_refresh="));

  return refreshCookie
    ? decodeURIComponent(refreshCookie.slice("expiry_admin_refresh=".length))
    : undefined;
}

function setRefreshCookie(response: CookieResponse, refreshToken: string) {
  response.setHeader(
    "Set-Cookie",
    buildRefreshCookieHeader(refreshToken, 2592000),
  );
}

function clearRefreshCookie(response: CookieResponse) {
  // Clear both legacy Path=/ and scoped Path=/auth cookies.
  response.setHeader("Set-Cookie", [
    buildRefreshCookieHeader("", 0, "/"),
    buildRefreshCookieHeader("", 0, "/auth"),
  ]);
}

function buildRefreshCookieHeader(
  refreshToken: string,
  maxAgeSeconds: number,
  path = "/auth",
) {
  return [
    `expiry_admin_refresh=${encodeURIComponent(refreshToken)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
