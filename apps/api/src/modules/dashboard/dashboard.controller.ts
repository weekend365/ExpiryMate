import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { DashboardService } from "./dashboard.service";

@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@CurrentOwnerKey() ownerKey: string) {
    return this.dashboardService.getSummary(ownerKey);
  }
}
