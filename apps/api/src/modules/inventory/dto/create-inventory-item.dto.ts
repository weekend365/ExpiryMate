import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
} from "@expirymate/shared";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class CreateInventoryItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsEnum(StorageLocation)
  storageLocation!: StorageLocation;

  @IsString()
  expiryDate!: string;

  @IsEnum(ExpirySource)
  expirySource!: ExpirySource;

  @IsOptional()
  @IsEnum(ItemStatus)
  status?: ItemStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
