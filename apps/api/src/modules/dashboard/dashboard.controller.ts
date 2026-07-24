import { Controller, Get, UseGuards } from "@nestjs/common";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { DashboardService } from "./dashboard.service";

@UseGuards(RegisteredGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@CurrentOwnerKey() ownerKey: string) {
    return this.dashboardService.getSummary(
      ownerKey,
      new Date(),
      `personal_${ownerKey}`,
    );
  }
}
