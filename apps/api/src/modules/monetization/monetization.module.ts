import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MonetizationController } from "./monetization.controller";
import { MonetizationService } from "./monetization.service";
import { CreditPurchasesService } from "./credit-purchases.service";

@Module({
  imports: [AuthModule],
  controllers: [MonetizationController],
  providers: [MonetizationService, CreditPurchasesService],
  exports: [MonetizationService, CreditPurchasesService],
})
export class MonetizationModule {}
