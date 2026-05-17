import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreateRecipeRecommendationDto } from "./dto/create-recipe-recommendation.dto";
import { RecipesService } from "./recipes.service";

@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post("recommendations")
  createRecommendation(@Body() dto: CreateRecipeRecommendationDto) {
    return this.recipesService.createRecommendation(dto);
  }

  @Get("recommendations")
  listRecommendations(@Query("ownerKey") ownerKey?: string) {
    return this.recipesService.listRecommendations(
      ownerKey ?? process.env.DEFAULT_OWNER_KEY ?? "demo-user",
    );
  }

  @Get("recommendations/:id")
  getRecommendation(@Param("id") id: string) {
    return this.recipesService.getRecommendation(id);
  }
}
