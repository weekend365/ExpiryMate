import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import type { PushTokenPlatform } from "@expirymate/shared";

export class RegisterPushTokenDto {
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/)
  token!: string;

  @IsOptional()
  @IsIn(["ios", "android", "web", "unknown"])
  platform?: PushTokenPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;
}

export class UnregisterPushTokenDto {
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/)
  token!: string;
}
