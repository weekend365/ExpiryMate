import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
} from "class-validator";

export class BatchDiscardInventoryItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  ownerKey?: string;
}
