import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
  type RegisterPushTokenRequest,
  type UnregisterPushTokenRequest,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { NotificationsService } from "./notifications.service";

@UseGuards(RegisteredGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("push-tokens")
  registerPushToken(
    @Body(new ZodValidationPipe(registerPushTokenSchema))
    dto: RegisterPushTokenRequest,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.notificationsService.registerPushToken(ownerKey, dto);
  }

  @Post("push-tokens/unregister")
  unregisterPushToken(
    @Body(new ZodValidationPipe(unregisterPushTokenSchema))
    dto: UnregisterPushTokenRequest,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.notificationsService.unregisterPushToken(ownerKey, dto.token);
  }
}
