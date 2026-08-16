import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SentryModule } from "@sentry/nestjs/setup";
import { PrismaModule } from "./database/prisma.module";
import { AdminModule } from "./modules/admin/admin.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PrivacyModule } from "./modules/privacy/privacy.module";
import { ProductsModule } from "./modules/products/products.module";
import { ProductMastersModule } from "./modules/product-masters/product-masters.module";
import { RecipesModule } from "./modules/recipes/recipes.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { SupportModule } from "./modules/support/support.module";
import { SpacesModule } from "./modules/spaces/spaces.module";
import { MonetizationModule } from "./modules/monetization/monetization.module";
import { AffiliateModule } from "./modules/affiliate/affiliate.module";

@Module({
  imports: [
    ...(process.env.SENTRY_DSN?.trim() ? [SentryModule.forRoot()] : []),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminModule,
    ProductsModule,
    ProductMastersModule,
    InventoryModule,
    DashboardModule,
    PrivacyModule,
    RecipesModule,
    MonetizationModule,
    AffiliateModule,
    SubscriptionsModule,
    SettingsModule,
    NotificationsModule,
    SupportModule,
    SpacesModule,
  ],
})
export class AppModule {}
