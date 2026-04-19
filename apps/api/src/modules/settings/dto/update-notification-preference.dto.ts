import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, Matches } from "class-validator";

export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  reminderDaysBefore?: number[];

  @IsOptional()
  @IsBoolean()
  remindOnDayOf?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  quietHoursEnd?: string;
}
