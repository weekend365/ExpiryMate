import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { VerifySubscriptionDto } from "./dto/verify-subscription.dto";
import { SubscriptionsService } from "./subscriptions.service";

@UseGuards(AuthGuard)
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
