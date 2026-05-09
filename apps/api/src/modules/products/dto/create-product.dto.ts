import { ProductCategory } from "@expirymate/shared";
import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  brand!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
