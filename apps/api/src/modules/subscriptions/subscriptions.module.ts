import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionEntitlementResyncService } from "./subscription-entitlement-resync.service";
import { MonetizationModule } from "../monetization/monetization.module";

@Module({
  imports: [AuthModule, MonetizationModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionEntitlementResyncService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
