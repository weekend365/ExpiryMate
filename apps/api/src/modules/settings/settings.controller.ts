import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("notification-preferences")
  getNotificationPreferences(@Query("ownerKey") ownerKey?: string) {
    return this.settingsService.getNotificationPreferences(
      ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? "demo-user",
    );
  }

  @Patch("notification-preferences")
  updateNotificationPreferences(
    @Body() dto: UpdateNotificationPreferenceDto,
    @Query("ownerKey") ownerKey?: string,
  ) {
    return this.settingsService.updateNotificationPreferences(
      ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? "demo-user",
      dto,
    );
  }
}
