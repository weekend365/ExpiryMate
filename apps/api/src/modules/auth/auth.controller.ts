import { Controller, Get } from "@nestjs/common";

@Controller("auth")
export class AuthController {
  @Get("placeholder")
  getPlaceholderSession() {
    return {
      userId: process.env.DEFAULT_OWNER_KEY ?? "demo-user",
      authRequired: false,
      message: "MVP 단계에서는 인증이 비활성화되어 있습니다.",
    };
  }
}
