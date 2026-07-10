import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentOwnerKey } from "../auth/current-owner-key.decorator";
import { ContributeBarcodeProductDto } from "./dto/contribute-barcode-product.dto";
import { ProductMastersService } from "./product-masters.service";

@Controller("product-masters")
export class ProductMastersController {
  constructor(private readonly productMastersService: ProductMastersService) {}

  @Get("lookup")
  lookup(@Query("barcode") barcode?: string) {
    return this.productMastersService.lookupByBarcode(barcode ?? "");
  }

  @Post("contribute")
  @UseGuards(AuthGuard)
  contribute(
    @Body() dto: ContributeBarcodeProductDto,
    @CurrentOwnerKey() ownerKey: string,
  ) {
    return this.productMastersService.contribute(dto, ownerKey);
  }
}
