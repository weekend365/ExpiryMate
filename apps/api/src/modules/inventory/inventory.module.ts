import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrivacyModule } from "../privacy/privacy.module";
import { SettingsModule } from "../settings/settings.module";
import { InventoryController } from "./inventory.controller";
import { InventoryPhotoParseCleanupService } from "./inventory-photo-parse-cleanup.service";
import { InventoryPhotoParsePolicyService } from "./inventory-photo-parse.policy";
import { InventoryPhotoParseService } from "./inventory-photo-parse.service";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [AuthModule, SettingsModule, PrivacyModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryPhotoParseService,
    InventoryPhotoParsePolicyService,
    InventoryPhotoParseCleanupService,
  ],
  exports: [
    InventoryService,
    InventoryPhotoParseService,
    InventoryPhotoParsePolicyService,
  ],
})
export class InventoryModule {}
