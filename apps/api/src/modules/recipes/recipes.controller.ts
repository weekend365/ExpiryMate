import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { CreateRecipeRecommendationDto } from "./dto/create-recipe-recommendation.dto";
import { RecipesService } from "./recipes.service";

@UseGuards(RegisteredGuard)
@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post("recommendations")
  createRecommendation(
    @Body() dto: CreateRecipeRecommendationDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.recipesService.createRecommendation(ownerKey, dto);
  }

  @Get("recommendations")
  listRecommendations(@CurrentOwnerKey() ownerKey: string) {
    return this.recipesService.listRecommendations(ownerKey);
  }

  @Get("recommendations/:id")
  getRecommendation(@Param("id") id: string, @CurrentOwnerKey() ownerKey: string) {
    return this.recipesService.getRecommendation(id, ownerKey);
  }
}
