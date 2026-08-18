import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RecipesModule } from "../recipes/recipes.module";
import { SettingsModule } from "../settings/settings.module";
import { AffiliateRecipesController } from "./affiliate.controller";
import { AffiliateOfferService } from "./affiliate-offer.service";
import { CoupangPartnersClient } from "./coupang-partners.client";
import { AffiliateReportSyncService } from "./affiliate-report-sync.service";

@Module({
  imports: [AuthModule, RecipesModule, SettingsModule],
  controllers: [AffiliateRecipesController],
  providers: [
    AffiliateOfferService,
    CoupangPartnersClient,
    AffiliateReportSyncService,
  ],
  exports: [AffiliateOfferService],
})
export class AffiliateModule {}
