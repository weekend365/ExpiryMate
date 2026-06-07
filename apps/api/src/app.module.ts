import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./database/prisma.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PrivacyModule } from "./modules/privacy/privacy.module";
import { ProductsModule } from "./modules/products/products.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";

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
    PrivacyModule,
    RecipesModule,
    SubscriptionsModule,
    SettingsModule,
  ],
})
export class AppModule {}
