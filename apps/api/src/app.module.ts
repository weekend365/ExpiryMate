import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./database/prisma.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ProductsModule } from "./modules/products/products.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { SettingsModule } from "./modules/settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    ProductsModule,
    InventoryModule,
    DashboardModule,
    RecipesModule,
    SettingsModule,
  ],
})
export class AppModule {}
