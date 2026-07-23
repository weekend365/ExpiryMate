import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
