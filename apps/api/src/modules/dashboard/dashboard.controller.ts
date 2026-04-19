import { Controller, Get, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@Query("ownerKey") ownerKey?: string) {
    return this.dashboardService.getSummary(
      ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? "demo-user",
    );
  }
}
