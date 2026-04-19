import { ProductCategory } from "@expirymate/shared";
import { IsEnum, IsOptional, IsString, IsUrl, Length, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @Length(8, 32)
  barcode!: string;

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
