import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { OAuthProvider } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
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
  VerifyEmailDto,
} from "./dto/auth.dto";
import type { AuthenticatedRequest } from "./auth.types";

interface CookieResponse {
  setHeader(name: string, value: string): void;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("anonymous")
  async issueAnonymousSession() {
    return this.authService.issueAnonymousSession();
  }

  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    const actor = await this.authService.getOptionalUserFromBearer(
      readAuthorization(request),
    );
    const session = await this.authService.register(dto, actor);

    return formatSessionForClient(session, client, response);
  }

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

    return formatSessionForClient(session, client, response);
  }

  @Post("refresh")
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshCookie(request);
    const session = await this.authService.refresh(refreshToken ?? "");

    return formatSessionForClient(session, client, response);
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

  @UseGuards(AuthGuard)
  @Get("me")
  getMe(@CurrentOwnerKey() ownerKey: string) {
    return this.authService.getMe(ownerKey);
  }

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

  @Post("email/verify")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post("password/forgot")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("password/reset")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("oauth/apple")
  oauthApple(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.apple, dto, request, response, client);
  }

  @Post("oauth/google")
  oauthGoogle(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.google, dto, request, response, client);
  }

  @Post("oauth/kakao")
  oauthKakao(
    @Body() dto: OAuthLoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
    @Headers("x-expirymate-client") client?: string,
  ) {
    return this.oauth(OAuthProvider.kakao, dto, request, response, client);
  }

  @Get("placeholder")
  getPlaceholderSession() {
    return {
      message: "인증은 /auth/anonymous, /auth/login, /auth/register를 사용합니다.",
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

    return formatSessionForClient(session, client, response);
  }
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
    [
      `expiry_admin_refresh=${encodeURIComponent(refreshToken)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=2592000",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
}

function clearRefreshCookie(response: CookieResponse) {
  response.setHeader(
    "Set-Cookie",
    [
      "expiry_admin_refresh=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
}
