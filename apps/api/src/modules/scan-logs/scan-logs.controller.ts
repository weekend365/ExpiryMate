import { Controller, Get, Query } from "@nestjs/common";
import { ScanLogsService } from "./scan-logs.service";

@Controller("scan-logs")
export class ScanLogsController {
  constructor(private readonly scanLogsService: ScanLogsService) {}

  @Get()
  findAll(@Query("matched") matched?: string, @Query("ownerKey") ownerKey?: string) {
    return this.scanLogsService.findAll({
      ownerKey: ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? "demo-user",
      matched:
        typeof matched === "string"
          ? matched === "true"
          : undefined,
    });
  }
}
