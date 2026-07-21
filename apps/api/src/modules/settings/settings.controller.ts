import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { SettingsService } from "./settings.service";
import { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";

@UseGuards(RegisteredGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("notification-preferences")
  getNotificationPreferences(@CurrentOwnerKey() ownerKey: string) {
    return this.settingsService.getNotificationPreferences(ownerKey);
  }

  @Patch("notification-preferences")
  updateNotificationPreferences(
    @Body() dto: UpdateNotificationPreferenceDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.settingsService.updateNotificationPreferences(ownerKey, dto);
  }
}
