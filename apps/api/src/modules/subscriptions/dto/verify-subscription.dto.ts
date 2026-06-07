import { IsIn, IsOptional, IsString } from "class-validator";
import type { SubscriptionStore } from "@expirymate/shared";

const subscriptionStores: SubscriptionStore[] = [
  "apple_app_store",
  "google_play",
];

export class VerifySubscriptionDto {
  @IsIn(subscriptionStores)
  store!: SubscriptionStore;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  purchaseToken?: string;

  @IsOptional()
  @IsIn(["sandbox", "production"])
  environment?: "sandbox" | "production";
}
