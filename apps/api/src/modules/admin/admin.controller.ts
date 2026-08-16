import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  updateProductMasterBodySchema,
  type UpdateProductMasterBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AdminGuard } from "../auth/admin.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { AdminService } from "./admin.service";
import { ProductMastersAdminService } from "./product-masters-admin.service";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly productMastersAdmin: ProductMastersAdminService,
  ) {}

  @Get("inventory")
  listInventory(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
  ) {
    return this.adminService.listInventory({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
    });
  }

  @Get("dashboard/summary")
  getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  @Get("monetization/overview")
  getMonetizationOverview(@Query("days") days?: string) {
    return this.adminService.getMonetizationOverview(
      days ? Number(days) : undefined,
    );
  }

  @Get("product-masters")
  listProductMasters(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
    @Query("source") source?: string,
    @Query("hasPendingCorrections") hasPendingCorrections?: string,
  ) {
    return this.productMastersAdmin.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      source,
      hasPendingCorrections: parseBooleanQuery(hasPendingCorrections),
    });
  }

  @Get("product-masters/:id")
  getProductMaster(@Param("id") id: string) {
    return this.productMastersAdmin.getDetail(id);
  }

  @Patch("product-masters/:id")
  updateProductMaster(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductMasterBodySchema))
    dto: UpdateProductMasterBody,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productMastersAdmin.update(id, dto, request.user!.ownerKey);
  }

  @Post("product-masters/:id/corrections/:correctionId/apply")
  applyProductMasterCorrection(
    @Param("id") id: string,
    @Param("correctionId") correctionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productMastersAdmin.applyCorrection(
      id,
      correctionId,
      request.user!.ownerKey,
    );
  }

  @Post("product-masters/:id/corrections/:correctionId/dismiss")
  dismissProductMasterCorrection(
    @Param("id") id: string,
    @Param("correctionId") correctionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productMastersAdmin.dismissCorrection(
      id,
      correctionId,
      request.user!.ownerKey,
    );
  }
}

function parseBooleanQuery(value?: string) {
  if (!value) {
    return false;
  }

  return value === "1" || value.toLowerCase() === "true";
}