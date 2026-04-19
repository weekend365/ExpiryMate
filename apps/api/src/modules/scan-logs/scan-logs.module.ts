import { Module } from "@nestjs/common";
import { ScanLogsController } from "./scan-logs.controller";
import { ScanLogsService } from "./scan-logs.service";

@Module({
  controllers: [ScanLogsController],
  providers: [ScanLogsService],
})
export class ScanLogsModule {}
