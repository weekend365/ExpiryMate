import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createUserStorageLocationBodySchema,
  updateUserStorageLocationBodySchema,
  type CreateUserStorageLocationBody,
  type UpdateUserStorageLocationBody,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
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

  @Get("storage-locations")
  listStorageLocations(@CurrentOwnerKey() ownerKey: string) {
    return this.settingsService.listStorageLocations(
      ownerKey,
      `personal_${ownerKey}`,
    );
  }

  @Post("storage-locations")
  createStorageLocation(
    @Body(new ZodValidationPipe(createUserStorageLocationBodySchema))
    dto: CreateUserStorageLocationBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.settingsService.createStorageLocation(
      ownerKey,
      dto,
      `personal_${ownerKey}`,
    );
  }

  @Patch("storage-locations/:id")
  updateStorageLocation(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserStorageLocationBodySchema))
    dto: UpdateUserStorageLocationBody,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.settingsService.updateStorageLocation(
      id,
      ownerKey,
      dto,
      `personal_${ownerKey}`,
    );
  }

  @Delete("storage-locations/:id")
  deleteStorageLocation(
    @Param("id") id: string,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.settingsService.deleteStorageLocation(
      id,
      ownerKey,
      `personal_${ownerKey}`,
    );
  }
}
