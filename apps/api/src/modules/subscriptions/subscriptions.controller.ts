import {
  Body,
  Controller,
  Get,
  Headers,
  Query,
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
  getEntitlement(
    @CurrentOwnerKey() ownerKey: string,
    @Query("spaceId") spaceId?: string,
  ) {
    return this.subscriptionsService.getEntitlement(ownerKey, spaceId);
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
    const results = await Promise.allSettled([
      this.subscriptionsService.processAppleNotification(body.signedPayload),
      this.creditPurchasesService.processValidatedAppleNotification(
        body.signedPayload,
      ),
    ]);
    return settleStoreNotificationResults(results);
  }

  @Post("notifications/google")
  async processGoogleNotification(
    @Body() body: { message?: { data?: string; messageId?: string } },
    @Headers("authorization") authorization?: string,
  ) {
    // OIDC verification lives in the subscription handler — run it first so
    // unauthenticated callers cannot revoke one-time credit purchases.
    await this.subscriptionsService.processGoogleNotification(
      authorization,
      body.message?.data,
    );
    return this.creditPurchasesService.processValidatedGoogleNotification(
      body.message?.data,
    );
  }
}

function settleStoreNotificationResults(
  results: PromiseSettledResult<{ ok: true }>[],
) {
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length === results.length) {
    throw failures[0]?.reason;
  }
  const success = results.find(
    (result): result is PromiseFulfilledResult<{ ok: true }> =>
      result.status === "fulfilled",
  );
  return success?.value ?? { ok: true as const };
}
