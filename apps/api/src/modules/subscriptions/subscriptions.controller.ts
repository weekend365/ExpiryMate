import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  subscriptionVerificationRequestSchema,
  type SubscriptionVerificationRequest,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
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
    @Body(new ZodValidationPipe(subscriptionVerificationRequestSchema))
    dto: SubscriptionVerificationRequest,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.subscriptionsService.verifySubscription(ownerKey, dto);
  }
}
