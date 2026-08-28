import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InventoryModule } from "../inventory/inventory.module";
import { MonetizationController } from "./monetization.controller";
import { MonetizationService } from "./monetization.service";
import { CreditPurchasesService } from "./credit-purchases.service";

@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [MonetizationController],
  providers: [MonetizationService, CreditPurchasesService],
  exports: [MonetizationService, CreditPurchasesService],
})
export class MonetizationModule {}
