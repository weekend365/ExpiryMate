import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import type { RecipeMealType } from "@expirymate/shared";

const mealTypes: RecipeMealType[] = [
  "any",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  return value;
};

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return Number(value);
};

export class CreateRecipeRecommendationDto {
  @IsOptional()
  @IsString()
  ownerKey?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  @Max(6)
  servings?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(5)
  @Max(120)
  maxCookingMinutes?: number;

  @IsOptional()
  @IsIn(mealTypes)
  mealType?: RecipeMealType;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  useExpiringFirst?: boolean;
}
