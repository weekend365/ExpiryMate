import { Controller, Get, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("anonymous")
  issueAnonymousSession() {
    return this.authService.issueAnonymousSession();
  }

  @Get("placeholder")
  getPlaceholderSession() {
    return {
      userId: process.env.DEFAULT_OWNER_KEY ?? "demo-user",
      authRequired: false,
      message: "MVP 단계에서는 인증이 비활성화되어 있습니다.",
    };
  }
}
