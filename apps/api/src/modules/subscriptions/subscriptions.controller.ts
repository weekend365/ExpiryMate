import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  subscriptionVerificationRequestSchema,
  type SubscriptionVerificationRequest,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { RegisteredGuard } from "../auth/registered.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get("entitlement")
  @UseGuards(RegisteredGuard)
  getEntitlement(@CurrentOwnerKey() ownerKey: string) {
    return this.subscriptionsService.getEntitlement(ownerKey);
  }

  @Post("verify")
  @UseGuards(RegisteredGuard)
  verifySubscription(
    @Body(new ZodValidationPipe(subscriptionVerificationRequestSchema))
    dto: SubscriptionVerificationRequest,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.subscriptionsService.verifySubscription(ownerKey, dto);
  }

  @Post("notifications/apple")
  processAppleNotification(@Body() body: { signedPayload?: string }) {
    return this.subscriptionsService.processAppleNotification(body.signedPayload);
  }

  @Post("notifications/google")
  processGoogleNotification(
    @Body() body: { message?: { data?: string; messageId?: string } },
    @Headers("authorization") authorization?: string,
  ) {
    return this.subscriptionsService.processGoogleNotification(
      authorization,
      body.message?.data,
    );
  }
}
