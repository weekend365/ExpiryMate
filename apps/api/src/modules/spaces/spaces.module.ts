import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DashboardModule } from "../dashboard/dashboard.module";
import { InventoryModule } from "../inventory/inventory.module";
import { RecipesModule } from "../recipes/recipes.module";
import { SettingsModule } from "../settings/settings.module";
import {
  SpaceDashboardController,
  SpaceInventoryController,
  SpaceRecipesController,
  SpaceStorageLocationsController,
} from "./space-resources.controller";
import {
  SpaceInvitationLinksController,
  SpaceInvitationsController,
  SpacesController,
} from "./spaces.controller";
import { SpacesService } from "./spaces.service";

@Module({
  imports: [
    AuthModule,
    DashboardModule,
    InventoryModule,
    RecipesModule,
    SettingsModule,
  ],
  controllers: [
    SpacesController,
    SpaceInvitationsController,
    SpaceInvitationLinksController,
    SpaceInventoryController,
    SpaceDashboardController,
    SpaceStorageLocationsController,
    SpaceRecipesController,
  ],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
