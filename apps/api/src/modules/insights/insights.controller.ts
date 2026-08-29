import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { InsightWindowDays } from "@expirymate/shared";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { InsightsService } from "./insights.service";

@UseGuards(RegisteredGuard)
@Controller("insights")
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get("preview")
  getPreview(
    @CurrentOwnerKey() ownerKey: string,
    @Query("spaceId") spaceId?: string,
  ) {
    if (!spaceId) {
      throw new BadRequestException("spaceId가 필요합니다.");
    }
    return this.insightsService.getPreview(ownerKey, spaceId);
  }

  @Get("overview")
  getOverview(
    @CurrentOwnerKey() ownerKey: string,
    @Query("spaceId") spaceId?: string,
    @Query("windowDays") windowDays?: string,
  ) {
    if (!spaceId) {
      throw new BadRequestException("spaceId가 필요합니다.");
    }
    if (windowDays !== "30" && windowDays !== "90") {
      throw new BadRequestException("windowDays는 30 또는 90이어야 합니다.");
    }
    return this.insightsService.getOverview(
      ownerKey,
      spaceId,
      Number(windowDays) as InsightWindowDays,
    );
  }
}
