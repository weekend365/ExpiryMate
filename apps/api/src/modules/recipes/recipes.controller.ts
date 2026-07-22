import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  recipeRecommendationRequestSchema,
  type RecipeRecommendationRequest,
} from "@expirymate/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { RegisteredGuard } from "../auth/registered.guard";
import { RecipesService } from "./recipes.service";

@UseGuards(RegisteredGuard)
@Controller("recipes")
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post("recommendations")
  createRecommendation(
    @Body(new ZodValidationPipe(recipeRecommendationRequestSchema))
    request: RecipeRecommendationRequest,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.recipesService.createRecommendation(ownerKey, request);
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
