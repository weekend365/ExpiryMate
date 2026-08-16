import { Controller, Get, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { AffiliateOfferService } from "./affiliate-offer.service";

@UseGuards(RegisteredGuard)
@Controller("recipes")
export class AffiliateRecipesController {
  constructor(private readonly affiliateOffers: AffiliateOfferService) {}

  @Get("recommendations/:id/dishes/:dishIndex/affiliate-offers")
  getOffers(
    @Param("id") id: string,
    @Param("dishIndex", ParseIntPipe) dishIndex: number,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.affiliateOffers.getOffersForDish({
      ownerKey,
      recommendationId: id,
      dishIndex,
      spaceId: `personal_${ownerKey}`,
    });
  }
}
