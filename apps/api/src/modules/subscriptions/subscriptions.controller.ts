import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { VerifySubscriptionDto } from "./dto/verify-subscription.dto";
import { SubscriptionsService } from "./subscriptions.service";

@UseGuards(RegisteredGuard)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get("entitlement")
  getEntitlement(@CurrentOwnerKey() ownerKey: string) {
    return this.subscriptionsService.getEntitlement(ownerKey);
  }

  @Post("verify")
  verifySubscription(
    @Body() dto: VerifySubscriptionDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.subscriptionsService.verifySubscription(ownerKey, dto);
  }
}
