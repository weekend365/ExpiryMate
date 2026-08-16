import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminAuditService } from "./admin-audit.service";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ProductMastersAdminService } from "./product-masters-admin.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuditService, ProductMastersAdminService],
  exports: [AdminService, AdminAuditService],
})
export class AdminModule {}
