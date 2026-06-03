import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminController],
})
export class AdminModule {}
