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
import { CreditPurchasesService } from "../monetization/credit-purchases.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creditPurchasesService: CreditPurchasesService,
  ) {}

  @Get("entitlement")
  @UseGuards(RegisteredGuard)
  getEntitlement(@CurrentOwnerKey() ownerKey: string) {
    return this.subscriptionsService.getEntitlement(ownerKey);
  }

  @Get("plus-insights")
  @UseGuards(RegisteredGuard)
  getPlusInsights(@CurrentOwnerKey() ownerKey: string) {
    return this.subscriptionsService.getPlusInsights(ownerKey);
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
  async processAppleNotification(@Body() body: { signedPayload?: string }) {
    await this.subscriptionsService.processAppleNotification(body.signedPayload);
    return this.creditPurchasesService.processValidatedAppleNotification(
      body.signedPayload,
    );
  }

  @Post("notifications/google")
  async processGoogleNotification(
    @Body() body: { message?: { data?: string; messageId?: string } },
    @Headers("authorization") authorization?: string,
  ) {
    await this.subscriptionsService.processGoogleNotification(
      authorization,
      body.message?.data,
    );
    return this.creditPurchasesService.processValidatedGoogleNotification(
      body.message?.data,
    );
  }
}
