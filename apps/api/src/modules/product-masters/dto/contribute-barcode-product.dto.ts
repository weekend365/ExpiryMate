import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ContributeBarcodeProductDto {
  @IsString()
  @Matches(/^\d{8,18}$/, {
    message: "바코드는 8~18자리 숫자여야 합니다.",
  })
  barcode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}
