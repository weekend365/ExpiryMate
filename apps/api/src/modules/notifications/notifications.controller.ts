import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from "./dto/register-push-token.dto";
import { NotificationsService } from "./notifications.service";

@UseGuards(RegisteredGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("push-tokens")
  registerPushToken(
    @Body() dto: RegisterPushTokenDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.notificationsService.registerPushToken(ownerKey, dto);
  }

  @Post("push-tokens/unregister")
  unregisterPushToken(
    @Body() dto: UnregisterPushTokenDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.notificationsService.unregisterPushToken(ownerKey, dto.token);
  }
}
