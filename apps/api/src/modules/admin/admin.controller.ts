import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminService } from "./admin.service";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
