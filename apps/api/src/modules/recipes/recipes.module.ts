import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrivacyModule } from "../privacy/privacy.module";
import { RecipePolicyService } from "./recipe-policy.service";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";

@Module({
  imports: [AuthModule, PrivacyModule],
  controllers: [RecipesController],
  providers: [RecipesService, RecipePolicyService],
  exports: [RecipesService],
})
export class RecipesModule {}
