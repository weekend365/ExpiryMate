import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrivacyModule } from "../privacy/privacy.module";
import { RecipesController } from "./recipes.controller";
import { RecipesService } from "./recipes.service";

@Module({
  imports: [AuthModule, PrivacyModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
