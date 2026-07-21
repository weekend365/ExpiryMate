import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AdminGuard } from "./admin.guard";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { MailService } from "./mail.service";
import { RegisteredGuard } from "./registered.guard";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    AuthGuard,
    RegisteredGuard,
    AdminGuard,
    AuthRateLimitGuard,
    AuthRateLimitService,
  ],
  exports: [AdminGuard, AuthGuard, RegisteredGuard, AuthService],
})
export class AuthModule {}
