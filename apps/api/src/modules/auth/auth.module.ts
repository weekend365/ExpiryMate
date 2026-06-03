import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { MailService } from "./mail.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, MailService, AuthGuard, AdminGuard],
  exports: [AdminGuard, AuthGuard, AuthService],
})
export class AuthModule {}
